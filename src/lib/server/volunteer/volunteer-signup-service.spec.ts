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
const countActiveSignups = vi.fn();
vi.mock('./volunteer-shift-service', () => ({
	getShiftById: (...a: unknown[]) => getShiftById(...a),
	countActiveSignups: (...a: unknown[]) => countActiveSignups(...a)
}));

const missingRequirements = vi.fn();
vi.mock('./member-certification-service', () => ({
	missingRequirements: (...a: unknown[]) => missingRequirements(...a)
}));

import {
	claimShift,
	completeFinishedShifts,
	ShiftFullError,
	ShiftClosedError,
	NotClearedError
} from './volunteer-signup-service';

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
	missingRequirements.mockResolvedValue([]);
	countActiveSignups.mockResolvedValue(0);
	getShiftById.mockResolvedValue(shift());
});

describe('claimShift', () => {
	it('claims an open shift', async () => {
		selectResultQueue = [[]]; // no existing signup

		await claimShift('shift-1', 'user-1');

		expect(insertedValues).toEqual([{ shiftId: 'shift-1', userId: 'user-1', status: 'claimed' }]);
	});

	it('refuses a shift that is already full', async () => {
		countActiveSignups.mockResolvedValue(2);
		selectResultQueue = [[]];

		await expect(claimShift('shift-1', 'user-1')).rejects.toThrow(ShiftFullError);
		expect(insertedValues).toEqual([]);
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
		selectResultQueue = [[]];

		await claimShift('shift-1', 'user-1');

		expect(missingRequirements).toHaveBeenCalledWith('user-1', 'role-1', FUTURE);
	});

	it('is idempotent when the member already has a live claim', async () => {
		selectResultQueue = [[{ id: 'signup-1', status: 'claimed' }], [{ id: 'signup-1' }]];

		await claimShift('shift-1', 'user-1');

		expect(insertedValues).toEqual([]);
	});

	it('reuses the row when re-claiming after cancelling', async () => {
		selectResultQueue = [[{ id: 'signup-1', status: 'cancelled' }]];

		await claimShift('shift-1', 'user-1');

		expect(insertedValues).toEqual([]);
		expect(updatedSets[0]).toMatchObject({ status: 'claimed', cancelledAt: null });
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
