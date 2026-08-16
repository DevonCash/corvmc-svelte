import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — the chainable db proxy from community-event-service.spec.ts, plus a
// `batch` spy (merge is the only place in the app that batches vote inserts).
// ---------------------------------------------------------------------------

let selectResultQueue: unknown[][] = [];
let insertResult: unknown[] = [];

function chainable(result?: () => unknown[]) {
	const proxy: any = new Proxy(() => proxy, {
		get(_, prop) {
			if (prop === 'then') {
				return (resolve: (v: unknown[]) => void) => {
					if (result) return resolve(result());
					return resolve(selectResultQueue.shift() ?? []);
				};
			}
			return () => proxy;
		}
	});
	return proxy;
}

/** Every write, in the order it happened — merge's ordering is load-bearing. */
let calls: string[] = [];
const insertValues = vi.fn();
const updateSet = vi.fn();
const deleteCalled = vi.fn();
const batchCalled = vi.fn();
const onConflictDoNothing = vi.fn();
const onConflictDoUpdate = vi.fn();

vi.mock('$lib/server/db', () => ({
	db: {
		select: vi.fn(() => chainable()),
		insert: vi.fn(() => ({
			values: vi.fn((v: unknown) => {
				calls.push('insert');
				insertValues(v);
				const ret: any = Object.assign(Promise.resolve(insertResult), {
					returning: () => Promise.resolve(insertResult),
					onConflictDoNothing: (c: unknown) => {
						onConflictDoNothing(c);
						return ret;
					},
					onConflictDoUpdate: (c: unknown) => {
						onConflictDoUpdate(c);
						return Promise.resolve(insertResult);
					}
				});
				return ret;
			})
		})),
		update: vi.fn(() => ({
			set: vi.fn((v: unknown) => {
				calls.push('update');
				updateSet(v);
				return chainable(() => []);
			})
		})),
		delete: vi.fn(() => {
			calls.push('delete');
			deleteCalled();
			return chainable(() => []);
		}),
		batch: vi.fn((stmts: unknown[]) => {
			calls.push('batch');
			batchCalled(stmts);
			return Promise.resolve([]);
		})
	}
}));

const emit = vi.fn(() => Promise.resolve());
vi.mock('$lib/server/events/event-bus', () => ({
	domainEvents: { emit: (...a: unknown[]) => emit(...(a as [])), on: vi.fn() }
}));
vi.mock('$lib/server/sentry', () => ({ captureException: vi.fn() }));

import {
	createSuggestion,
	toggleVote,
	mergeSuggestions,
	respondToSuggestion,
	withholdForReview,
	revokeSuggestionTrust,
	displayStatus,
	SuggestionNotFoundError,
	SuggestionClosedError,
	SuggestionMergeError,
	SuggestionValidationError
} from './suggestion-service';
import { SUGGESTION_TITLE_MAX, SUGGESTION_BODY_MAX } from '$lib/config';

beforeEach(() => {
	selectResultQueue = [];
	insertResult = [{ id: 's1' }];
	calls = [];
	vi.clearAllMocks();
});

/** Flush the fire-and-forget `Promise.resolve().then()` in notifyAuthor. */
const flushMicrotasks = () => new Promise((r) => setTimeout(r, 0));

describe('createSuggestion', () => {
	it('trims and truncates title and body to their limits', async () => {
		selectResultQueue = [[]]; // no standing row → trusted
		await createSuggestion({
			authorUserId: 'u1',
			title: '  ' + 'T'.repeat(SUGGESTION_TITLE_MAX + 50) + '  ',
			body: 'B'.repeat(SUGGESTION_BODY_MAX + 50),
			category: 'other'
		});

		const v = insertValues.mock.calls[0][0] as { title: string; body: string };
		expect(v.title).toHaveLength(SUGGESTION_TITLE_MAX);
		expect(v.body).toHaveLength(SUGGESTION_BODY_MAX);
	});

	it('publishes straight to the board for a member in good standing', async () => {
		selectResultQueue = [[]];
		await createSuggestion({ authorUserId: 'u1', title: 'T', body: 'B', category: 'policy' });

		expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ visibility: 'visible' }));
	});

	it('withholds the post when the author is required to post under review', async () => {
		selectResultQueue = [
			[{ requiresReview: true, reason: 'spam', triggeringFlagId: 'f1', updatedAt: new Date() }]
		];
		await createSuggestion({ authorUserId: 'u1', title: 'T', body: 'B', category: 'policy' });

		expect(insertValues).toHaveBeenCalledWith(
			expect.objectContaining({ visibility: 'pending_review' })
		);
	});

	it('rejects an empty title', async () => {
		selectResultQueue = [[]];
		await expect(
			createSuggestion({ authorUserId: 'u1', title: '   ', body: 'B', category: 'other' })
		).rejects.toThrow(SuggestionValidationError);
	});
});

describe('toggleVote', () => {
	it('adds a vote when none exists, deduped by the unique index', async () => {
		selectResultQueue = [
			[{ id: 's1', visibility: 'visible', mergedIntoId: null }],
			[], // no existing vote
			[{ count: 4 }]
		];
		const result = await toggleVote('s1', 'u1');

		expect(result).toEqual({ voted: true, voteCount: 4 });
		expect(onConflictDoNothing).toHaveBeenCalledOnce();
	});

	it('removes the vote when one already exists', async () => {
		selectResultQueue = [
			[{ id: 's1', visibility: 'visible', mergedIntoId: null }],
			[{ id: 'v1' }],
			[{ count: 3 }]
		];
		const result = await toggleVote('s1', 'u1');

		expect(result).toEqual({ voted: false, voteCount: 3 });
		expect(deleteCalled).toHaveBeenCalledOnce();
	});

	it('404s an unknown suggestion', async () => {
		selectResultQueue = [[]];
		await expect(toggleVote('nope', 'u1')).rejects.toThrow(SuggestionNotFoundError);
	});

	it.each(['pending_review', 'under_review', 'hidden'])(
		'refuses a vote on a %s suggestion',
		async (visibility) => {
			selectResultQueue = [[{ id: 's1', visibility, mergedIntoId: null }]];
			await expect(toggleVote('s1', 'u1')).rejects.toThrow(SuggestionClosedError);
		}
	);

	it('refuses a vote on a merged suggestion', async () => {
		selectResultQueue = [[{ id: 's1', visibility: 'visible', mergedIntoId: 's2' }]];
		await expect(toggleVote('s1', 'u1')).rejects.toThrow(SuggestionClosedError);
	});
});

describe('withholdForReview', () => {
	it('pulls a visible suggestion off the board with no staff actor', async () => {
		selectResultQueue = [
			[
				{
					id: 's1',
					title: 'T',
					authorUserId: 'u1',
					authorName: 'Ada',
					authorEmail: 'ada@example.com',
					visibility: 'visible'
				}
			]
		];
		await withholdForReview('s1', { flagId: 'f1' });

		expect(updateSet).toHaveBeenCalledWith(
			expect.objectContaining({ visibility: 'under_review', visibilityChangedByUserId: null })
		);
	});

	it('is a no-op on a suggestion that is already off the board', async () => {
		selectResultQueue = [
			[
				{
					id: 's1',
					title: 'T',
					authorUserId: 'u1',
					authorName: 'Ada',
					authorEmail: 'ada@example.com',
					visibility: 'hidden'
				}
			]
		];
		await withholdForReview('s1', { flagId: 'f2' });

		expect(updateSet).not.toHaveBeenCalled();
	});
});

describe('mergeSuggestions', () => {
	const staffId = 'staff1';

	it('refuses to merge a suggestion into itself', async () => {
		await expect(mergeSuggestions({ sourceId: 's1', targetId: 's1', staffId })).rejects.toThrow(
			SuggestionMergeError
		);
	});

	it('refuses a target that was itself merged, rather than following the chain', async () => {
		selectResultQueue = [
			[
				{ id: 's1', title: 'A', mergedIntoId: null },
				{ id: 's2', title: 'B', mergedIntoId: 's3' }
			]
		];
		await expect(mergeSuggestions({ sourceId: 's1', targetId: 's2', staffId })).rejects.toThrow(
			/points at/
		);
	});

	it('refuses a source already merged somewhere else', async () => {
		selectResultQueue = [
			[
				{ id: 's1', title: 'A', mergedIntoId: 's9' },
				{ id: 's2', title: 'B', mergedIntoId: null }
			]
		];
		await expect(mergeSuggestions({ sourceId: 's1', targetId: 's2', staffId })).rejects.toThrow(
			/already merged/
		);
	});

	it('404s when either suggestion is missing', async () => {
		selectResultQueue = [[{ id: 's1', title: 'A', mergedIntoId: null }]];
		await expect(mergeSuggestions({ sourceId: 's1', targetId: 'gone', staffId })).rejects.toThrow(
			SuggestionNotFoundError
		);
	});

	it('transfers votes BEFORE marking the source merged', async () => {
		selectResultQueue = [
			[
				{ id: 's1', title: 'A', mergedIntoId: null },
				{ id: 's2', title: 'B', mergedIntoId: null }
			],
			[{ userId: 'u1' }, { userId: 'u2' }]
		];
		await mergeSuggestions({ sourceId: 's1', targetId: 's2', staffId });

		// A crash between the two steps must leave both on the board with no vote
		// lost — which is only true in this order.
		expect(calls.indexOf('batch')).toBeLessThan(calls.indexOf('update'));
	});

	it('dedupes transferred votes via onConflictDoNothing on (suggestion, user)', async () => {
		selectResultQueue = [
			[
				{ id: 's1', title: 'A', mergedIntoId: null },
				{ id: 's2', title: 'B', mergedIntoId: null }
			],
			[{ userId: 'u1' }]
		];
		await mergeSuggestions({ sourceId: 's1', targetId: 's2', staffId });

		expect(onConflictDoNothing).toHaveBeenCalledOnce();
		expect(insertValues).toHaveBeenCalledWith([{ suggestionId: 's2', userId: 'u1' }]);
	});

	it('chunks the transfer so no statement exceeds D1 bound-param limits', async () => {
		const voters = Array.from({ length: 60 }, (_, i) => ({ userId: `u${i}` }));
		selectResultQueue = [
			[
				{ id: 's1', title: 'A', mergedIntoId: null },
				{ id: 's2', title: 'B', mergedIntoId: null }
			],
			voters
		];
		const result = await mergeSuggestions({ sourceId: 's1', targetId: 's2', staffId });

		expect(result.transferred).toBe(60);
		// 60 voters at 25 per statement → 3 statements in one batch.
		expect(batchCalled.mock.calls[0][0]).toHaveLength(3);
	});

	it('skips the batch entirely when the source has no votes', async () => {
		selectResultQueue = [
			[
				{ id: 's1', title: 'A', mergedIntoId: null },
				{ id: 's2', title: 'B', mergedIntoId: null }
			],
			[]
		];
		await mergeSuggestions({ sourceId: 's1', targetId: 's2', staffId });

		expect(batchCalled).not.toHaveBeenCalled();
	});

	it('re-running the same merge repairs rather than errors', async () => {
		selectResultQueue = [
			[
				{ id: 's1', title: 'A', mergedIntoId: 's2' },
				{ id: 's2', title: 'B', mergedIntoId: null }
			],
			[{ userId: 'u1' }]
		];
		await expect(mergeSuggestions({ sourceId: 's1', targetId: 's2', staffId })).resolves.toEqual({
			transferred: 1
		});
	});
});

describe('respondToSuggestion', () => {
	it('notifies the author exactly once', async () => {
		selectResultQueue = [
			[
				{
					id: 's1',
					title: 'T',
					authorUserId: 'u1',
					authorName: 'Ada',
					authorEmail: 'ada@example.com'
				}
			]
		];
		await respondToSuggestion('s1', {
			status: 'planned',
			response: 'Good idea',
			staffId: 'staff1'
		});
		await flushMicrotasks();

		expect(emit).toHaveBeenCalledOnce();
		expect(emit).toHaveBeenCalledWith(
			'suggestion.responded',
			expect.objectContaining({ authorUserId: 'u1', status: 'planned', statusLabel: 'Planned' })
		);
	});

	it('stays silent when the suggestion has no author left', async () => {
		selectResultQueue = [
			[{ id: 's1', title: 'T', authorUserId: null, authorName: null, authorEmail: null }]
		];
		await respondToSuggestion('s1', { status: 'done', staffId: 'staff1' });
		await flushMicrotasks();

		expect(emit).not.toHaveBeenCalled();
	});

	it('clears the response fields when the reply is emptied', async () => {
		selectResultQueue = [
			[
				{
					id: 's1',
					title: 'T',
					authorUserId: 'u1',
					authorName: 'Ada',
					authorEmail: 'ada@example.com'
				}
			]
		];
		await respondToSuggestion('s1', { status: 'open', response: '', staffId: 'staff1' });

		expect(updateSet).toHaveBeenCalledWith(
			expect.objectContaining({ responseBody: null, responseAt: null, responseByUserId: null })
		);
	});
});

describe('revokeSuggestionTrust', () => {
	it('upserts so a second upheld report does not conflict', async () => {
		await revokeSuggestionTrust({ userId: 'u1', flagId: 'f1', staffId: 'staff1', reason: 'spam' });

		expect(onConflictDoUpdate).toHaveBeenCalledOnce();
		expect(insertValues).toHaveBeenCalledWith(
			expect.objectContaining({ userId: 'u1', requiresReview: true, triggeringFlagId: 'f1' })
		);
	});
});

describe('displayStatus', () => {
	it('derives merged from mergedIntoId rather than reading a stored status', () => {
		expect(displayStatus({ status: 'open', mergedIntoId: 's2' })).toBe('merged');
		expect(displayStatus({ status: 'planned', mergedIntoId: null })).toBe('planned');
	});
});

describe('notification safety', () => {
	it('stays silent when the author has no address to write to', async () => {
		selectResultQueue = [
			[{ id: 's1', title: 'T', authorUserId: 'u1', authorName: 'Ada', authorEmail: null }]
		];
		await respondToSuggestion('s1', { status: 'done', staffId: 'staff1' });
		await flushMicrotasks();

		expect(emit).not.toHaveBeenCalled();
	});

	it('does not notify staff about their own suggestion', async () => {
		selectResultQueue = [
			[{ id: 's1', title: 'T', authorUserId: 'staff1', authorName: 'Sam', authorEmail: 's@x.com' }]
		];
		await respondToSuggestion('s1', { status: 'planned', staffId: 'staff1' });
		await flushMicrotasks();

		expect(emit).not.toHaveBeenCalled();
	});
});
