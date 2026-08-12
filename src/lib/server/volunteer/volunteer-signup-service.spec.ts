import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
// The claim path is three guards and an insert. These stub the two collaborators
// it leans on — the shift lookup and the clearance check — so each guard can be
// driven independently.
// ---------------------------------------------------------------------------

let selectResultQueue: unknown[][] = [];
let insertedValues: unknown[] = [];
let updatedSets: unknown[] = [];
let insertError: Error | null = null;
/** Rows the conditional INSERT/UPDATE returns — empty means "no room left". */
let rawWriteResult: unknown[] = [{ id: 'signup-new' }];
/** The conditional write statements, kept so a test can render and inspect one. */
let rawWrites: SQL[] = [];

function chainable(sink?: unknown[]) {
	const proxy: any = new Proxy(() => proxy, {
		get(_, prop) {
			if (prop === 'then') {
				return (resolve: (v: unknown[]) => void) => resolve(selectResultQueue.shift() ?? []);
			}
			if (prop === 'set') {
				return (v: unknown) => {
					sink?.push(v);
					return proxy;
				};
			}
			return () => proxy;
		}
	});
	return proxy;
}

vi.mock('$lib/server/db', () => ({
	db: {
		// The claim path writes with a conditional statement through `all`, so the
		// capacity test and the write are one round trip. Capturing the SQL lets
		// the tests assert the guard is actually in the statement.
		all: vi.fn((q: unknown) => {
			rawWrites.push(q as SQL);
			if (insertError) throw insertError;
			return Promise.resolve(rawWriteResult);
		}),
		select: vi.fn(() => chainable()),
		insert: vi.fn(() => ({
			values: vi.fn((v: unknown) => {
				if (insertError) throw insertError;
				insertedValues.push(v);
				return { returning: vi.fn(() => Promise.resolve([v])) };
			})
		})),
		update: vi.fn(() => chainable(updatedSets)),
		delete: vi.fn(() => chainable())
	}
}));

vi.mock('$lib/server/authorization', () => ({ primaryRoleFor: vi.fn(() => null) }));

const getShiftById = vi.fn();
vi.mock('./volunteer-shift-service', () => ({
	getShiftById: (...a: unknown[]) => getShiftById(...a)
}));

const missingRequirements = vi.fn();
/**
 * The onboarding gate `claimShift` now runs first. Stubbed to a cleared
 * volunteer by default so the guards under test stay the subject; the blocked
 * cases drive it explicitly. Real error classes come from the original module.
 */
const requireActiveVolunteer = vi.fn(async () => ({ id: 'vp-1', status: 'active' }));
vi.mock('./volunteer-profile-service', async (importOriginal) => ({
	...(await importOriginal<object>()),
	requireActiveVolunteer: (...args: unknown[]) => requireActiveVolunteer(...(args as []))
}));

vi.mock('./member-certification-service', () => ({
	missingRequirements: (...a: unknown[]) => missingRequirements(...a)
}));

import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core';
import type { SQL } from 'drizzle-orm';
import {
	claimShift,
	completeFinishedShifts,
	ShiftFullError,
	ShiftClosedError,
	NotClearedError
} from './volunteer-signup-service';
import {
	VolunteerProfileBlockedError,
	VolunteerProfileNotFoundError
} from './volunteer-profile-service';

const render = (q: SQL) => new SQLiteSyncDialect().sqlToQuery(q).sql;

const FUTURE = new Date(Date.now() + 7 * 86_400_000);
const LATER = new Date(Date.now() + 7 * 86_400_000 + 4 * 3_600_000);

function shift(over: Record<string, unknown> = {}) {
	return {
		id: 'shift-1',
		volunteerRoleId: 'role-1',
		startsAt: FUTURE,
		endsAt: LATER,
		capacity: 2,
		cancelledAt: null,
		...over
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	selectResultQueue = [];
	insertedValues = [];
	updatedSets = [];
	insertError = null;
	rawWriteResult = [{ id: 'signup-new' }];
	rawWrites = [];
	missingRequirements.mockResolvedValue([]);
	getShiftById.mockResolvedValue(shift());
	requireActiveVolunteer.mockResolvedValue({ id: 'vp-1', status: 'active' });
});

describe('claimShift', () => {
	/**
	 * The onboarding gate runs before every other guard, and it runs in the
	 * service rather than only on the route: /member/volunteer redirects an
	 * un-onboarded member, but a remote function is a directly callable endpoint
	 * and a redirect stops nothing that isn't a browser following it. This is the
	 * check that actually keeps an under-18 signup off a shift.
	 */
	it('refuses a claim from a member whose profile is blocked', async () => {
		requireActiveVolunteer.mockRejectedValue(new VolunteerProfileBlockedError());

		await expect(claimShift('shift-1', 'user-1')).rejects.toThrow(VolunteerProfileBlockedError);
		expect(getShiftById).not.toHaveBeenCalled();
	});

	it('refuses a claim from a member who has not onboarded at all', async () => {
		requireActiveVolunteer.mockRejectedValue(new VolunteerProfileNotFoundError());

		await expect(claimShift('shift-1', 'user-1')).rejects.toThrow(VolunteerProfileNotFoundError);
	});

	it('claims an open shift', async () => {
		// No existing signup, then the typed re-read of the row just written.
		selectResultQueue = [[], [{ id: 'signup-new', status: 'claimed' }]];

		const row = await claimShift('shift-1', 'user-1');

		expect(row).toMatchObject({ id: 'signup-new' });
	});

	/**
	 * The capacity test lives inside the write, not in a separate read. Two
	 * members claiming the last place would both pass a read-then-write check,
	 * and the unique index on (shiftId, userId) cannot arbitrate that — they are
	 * different users. SQLite decides instead: the losing statement matches no
	 * rows and returns nothing.
	 */
	it('makes the capacity test part of the write statement', async () => {
		selectResultQueue = [[], [{ id: 'signup-new', status: 'claimed' }]];

		await claimShift('shift-1', 'user-1');

		expect(rawWrites).toHaveLength(1);
		const written = render(rawWrites[0]);
		expect(written).toContain('insert into "volunteer_signup"');
		expect(written).toContain('select count(*) from "volunteer_signup"');
	});

	it('refuses when the conditional write finds no room', async () => {
		selectResultQueue = [[]];
		// The statement ran but matched nothing: somebody took the last place
		// between this request reading the shift and writing its claim.
		rawWriteResult = [];

		await expect(claimShift('shift-1', 'user-1')).rejects.toThrow(ShiftFullError);
	});

	it('refuses a cancelled shift', async () => {
		getShiftById.mockResolvedValue(shift({ cancelledAt: new Date() }));

		await expect(claimShift('shift-1', 'user-1')).rejects.toThrow(ShiftClosedError);
	});

	it('refuses a shift that already happened', async () => {
		getShiftById.mockResolvedValue(
			shift({
				startsAt: new Date(Date.now() - 86_400_000),
				endsAt: new Date(Date.now() - 3_600_000)
			})
		);

		await expect(claimShift('shift-1', 'user-1')).rejects.toThrow(ShiftClosedError);
	});

	// The whole point of certifications gating here rather than at hour logging.
	it('refuses when the member is missing a required clearance', async () => {
		missingRequirements.mockResolvedValue([{ id: 'c1', name: 'Sound Desk Cleared' }]);
		selectResultQueue = [[]];

		await expect(claimShift('shift-1', 'user-1')).rejects.toThrow(NotClearedError);
		expect(insertedValues).toEqual([]);
	});

	it('names the missing clearance in the message, so the member knows what to get', async () => {
		missingRequirements.mockResolvedValue([{ id: 'c1', name: 'Sound Desk Cleared' }]);
		selectResultQueue = [[]];

		await expect(claimShift('shift-1', 'user-1')).rejects.toThrow(/Sound Desk Cleared/);
	});

	// Clearance is asked about the shift's date, not today — a card that lapses
	// before the shift shouldn't let someone claim it.
	it('checks clearance as of the shift date', async () => {
		selectResultQueue = [[], [{ id: 'signup-new', status: 'claimed' }]];

		await claimShift('shift-1', 'user-1');

		expect(missingRequirements).toHaveBeenCalledWith('user-1', 'role-1', FUTURE);
	});

	it('is idempotent when the member already has a live claim', async () => {
		selectResultQueue = [[{ id: 'signup-1', status: 'claimed' }], [{ id: 'signup-1' }]];

		await claimShift('shift-1', 'user-1');

		expect(rawWrites).toEqual([]);
	});

	it('reuses the row when re-claiming after cancelling', async () => {
		selectResultQueue = [[{ id: 'signup-1', status: 'cancelled' }], [{ id: 'signup-1' }]];

		await claimShift('shift-1', 'user-1');

		expect(render(rawWrites[0])).toContain('update "volunteer_signup"');
	});

	// Re-claiming a place that filled up while they were away must not revive
	// the row — the same conditional guards the update.
	it('refuses to revive a cancelled claim when the shift filled up', async () => {
		selectResultQueue = [[{ id: 'signup-1', status: 'cancelled' }]];
		rawWriteResult = [];

		await expect(claimShift('shift-1', 'user-1')).rejects.toThrow(ShiftFullError);
	});

	it('falls back to the existing row when the unique index fires on a double click', async () => {
		selectResultQueue = [[], [{ id: 'signup-1', status: 'claimed' }]];
		insertError = new Error('UNIQUE constraint failed: volunteer_signup.shift_id');

		const row = await claimShift('shift-1', 'user-1');

		expect(row).toMatchObject({ id: 'signup-1' });
	});
});

describe('completeFinishedShifts', () => {
	it('does nothing when nothing is due', async () => {
		selectResultQueue = [[]];
		expect(await completeFinishedShifts()).toEqual([]);
		expect(updatedSets).toEqual([]);
	});

	it('completes the due signups and returns them for the feedback ask', async () => {
		selectResultQueue = [
			[
				{
					signupId: 's1',
					userId: 'u1',
					userName: 'A',
					userEmail: 'a@x',
					shiftId: 'sh1',
					roleName: 'Door',
					startsAt: FUTURE,
					endsAt: LATER
				}
			]
		];

		const done = await completeFinishedShifts();

		expect(done).toHaveLength(1);
		expect(updatedSets[0]).toMatchObject({ status: 'completed' });
	});
});
