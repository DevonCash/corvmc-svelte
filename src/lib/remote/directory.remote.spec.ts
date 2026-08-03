import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { z } from 'zod';

// Regression: the member and band profile forms decoded their JSON-encoded array
// fields with `.transform((s) => { try { return JSON.parse(s) } catch { return [] } })`.
// The catch is the defect. `instruments`, `genres` and `links` are written
// straight through to updateMemberProfile / updateBandProfile, which replace the
// stored value wholesale — so any submission whose hidden input was malformed
// (a truncated payload, a client-side serialisation bug, a hand-rolled POST)
// silently *erased* the member's instruments, genres and links instead of
// failing. This is the same shape as the role-wipe fixed in #162, where a
// silently-empty array wiped every role off a user on an unrelated field edit.
//
// jsonArrayField() reports a field issue instead, so the save is rejected and
// the stored value is left alone. These tests pin that: a malformed array field
// must NOT reach the handler.

const updateMemberProfile = vi.fn(async () => undefined);
const updateBandProfile = vi.fn(async () => ({ slug: 'the-regressions' }));

vi.mock('$lib/server/directory/profile-service', () => ({
	getMemberProfileForEdit: vi.fn(async () => null),
	updateMemberProfile: (...args: unknown[]) => updateMemberProfile(...(args as [])),
	getBandProfileForEdit: vi.fn(async () => null),
	updateBandProfile: (...args: unknown[]) => updateBandProfile(...(args as []))
}));

vi.mock('$lib/server/directory/directory-service', () => ({
	listMembers: vi.fn(),
	listBands: vi.fn(),
	getPublicDirectory: vi.fn(),
	getMemberProfile: vi.fn(),
	suggestInstruments: vi.fn(),
	suggestGenres: vi.fn()
}));

vi.mock('$lib/server/authorization', () => ({
	requireUser: () => ({ id: 'user-1', name: 'Member', email: 'member@example.com' })
}));

vi.mock('$lib/server/band/band-context', () => ({
	requireBandAdmin: vi.fn(async () => ({ user: { id: 'user-1' }, band: { id: 'band-1' } }))
}));

vi.mock('$lib/server/event/event-service', () => ({
	listBandEventsUpcoming: vi.fn(),
	countBandPastEvents: vi.fn(),
	listMemberUpcomingShows: vi.fn(),
	countMemberPastShows: vi.fn()
}));

vi.mock('$lib/server/band/band-service', () => ({
	update: vi.fn(async () => ({ slug: 'the-regressions' }))
}));
vi.mock('$lib/server/storage', () => ({ resolveImageUrl: (v: unknown) => v }));
vi.mock('$lib/server/sentry', () => ({ captureException: vi.fn() }));
vi.mock('$lib/server/db', () => ({ db: {} }));

/**
 * A faithful-enough `form()`: the real one runs the Zod schema before the
 * handler and never calls the handler on a validation failure. The default
 * pass-through mock used elsewhere in this suite skips validation entirely,
 * which is exactly the layer under test here.
 */
class ValidationFailure extends Error {
	constructor(readonly issues: z.core.$ZodIssue[]) {
		super('validation failed');
	}
}

vi.mock('$app/server', () => ({
	getRequestEvent: () => ({
		locals: { user: null },
		url: new URL('http://localhost/'),
		request: { headers: new Headers() }
	}),
	query: (...args: unknown[]) => {
		const handler = (typeof args[0] === 'function' ? args[0] : args[1]) as (
			...a: unknown[]
		) => unknown;
		// The forms call `getX().refresh()` after a successful write, so the call
		// result has to be a thenable carrying `.refresh`.
		const wrapped = (...a: unknown[]) => {
			const promise = Promise.resolve(handler(...a)) as Promise<unknown> & { refresh(): void };
			promise.refresh = () => undefined;
			return promise;
		};
		(wrapped as unknown as Record<string, unknown>).__ = { type: 'query' };
		return wrapped;
	},
	form: (schema: z.ZodType, handler: (...a: unknown[]) => unknown) => {
		const fn = async (raw: unknown) => {
			const parsed = schema.safeParse(raw);
			if (!parsed.success) throw new ValidationFailure(parsed.error.issues);
			return handler(parsed.data);
		};
		const marked = fn as unknown as Record<string, unknown>;
		marked.__ = { type: 'form' };
		marked.for = () => fn;
		return fn;
	},
	command: (...args: unknown[]) => {
		const handler = (typeof args[0] === 'function' ? args[0] : args[1]) as (
			...a: unknown[]
		) => unknown;
		(handler as unknown as Record<string, unknown>).__ = { type: 'command' };
		return handler;
	}
}));

const directory = (await import('./directory.remote')) as unknown as Record<
	string,
	(...args: unknown[]) => Promise<unknown>
>;

beforeEach(() => {
	vi.clearAllMocks();
});

const VALID_MEMBER = {
	tagline: '',
	bio: '',
	hometown: '',
	instruments: '["guitar","bass"]',
	genres: '["rock"]',
	lookingForBand: false,
	availableForHire: false,
	teachesLessons: false,
	openToCollaboration: false,
	directoryVisibility: 'members' as const,
	contactEmail: '',
	contactPhone: '',
	contactSocial: '',
	contactPublic: false,
	links: '[]'
};

const VALID_BAND = {
	name: 'The Regressions',
	bio: '',
	tagline: '',
	hometown: '',
	foundedYear: '',
	genres: '["punk"]',
	lookingForMembers: false,
	directoryVisibility: 'public' as const,
	contactEmail: '',
	contactPhone: '',
	contactSocial: '',
	links: '[]'
};

describe('saveMemberProfile', () => {
	it('saves the decoded arrays on a well-formed submission', async () => {
		await directory.saveMemberProfile(VALID_MEMBER);

		expect(updateMemberProfile).toHaveBeenCalledWith(
			'user-1',
			expect.objectContaining({ instruments: ['guitar', 'bass'], genres: ['rock'] })
		);
	});

	for (const field of ['instruments', 'genres', 'links'] as const) {
		it(`rejects malformed ${field} instead of silently clearing it`, async () => {
			await expect(
				directory.saveMemberProfile({ ...VALID_MEMBER, [field]: 'not-json' })
			).rejects.toBeInstanceOf(ValidationFailure);

			// The bug: the handler ran with `[]` and wiped the stored value.
			expect(updateMemberProfile).not.toHaveBeenCalled();
		});
	}

	it('rejects a JSON scalar where an array is required', async () => {
		await expect(
			directory.saveMemberProfile({ ...VALID_MEMBER, instruments: '"guitar"' })
		).rejects.toBeInstanceOf(ValidationFailure);

		expect(updateMemberProfile).not.toHaveBeenCalled();
	});
});

describe('saveBandProfile', () => {
	it('saves the decoded arrays on a well-formed submission', async () => {
		await directory.saveBandProfile(VALID_BAND);

		expect(updateBandProfile).toHaveBeenCalledWith(
			'band-1',
			'user-1',
			expect.objectContaining({ genres: ['punk'] })
		);
	});

	for (const field of ['genres', 'links'] as const) {
		it(`rejects malformed ${field} instead of silently clearing it`, async () => {
			await expect(
				directory.saveBandProfile({ ...VALID_BAND, [field]: '{oops' })
			).rejects.toBeInstanceOf(ValidationFailure);

			expect(updateBandProfile).not.toHaveBeenCalled();
		});
	}
});
