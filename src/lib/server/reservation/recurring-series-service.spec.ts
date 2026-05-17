import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies before importing the module under test
// ---------------------------------------------------------------------------

vi.mock('$lib/server/db', () => ({
	db: {
		select: vi.fn(),
		update: vi.fn(),
		transaction: vi.fn()
	}
}));

vi.mock('$lib/server/db/schema/recurring', () => ({
	recurringSeries: { id: 'recurringSeries.id' }
}));

vi.mock('$lib/server/db/schema/reservation', () => ({
	reservation: { id: 'reservation.id' }
}));

vi.mock('$lib/server/db/schema/auth', () => ({
	user: { id: 'user.id' }
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn((col, val) => ({ eq: [col, val] })),
	and: vi.fn((...args) => ({ and: args })),
	isNull: vi.fn((col) => ({ isNull: col })),
	inArray: vi.fn((col, vals) => ({ inArray: [col, vals] }))
}));

vi.mock('$lib/server/authorization', () => ({
	primaryRoleFor: vi.fn(() => 'member')
}));

vi.mock('./rrule-helpers', () => ({
	buildRRule: vi.fn(() => 'FREQ=WEEKLY;BYDAY=MO'),
	describeFrequency: vi.fn(() => 'Weekly')
}));

vi.mock('./config', () => ({}));

// ---------------------------------------------------------------------------
// Import module under test and mocked dependencies
// ---------------------------------------------------------------------------

import { db } from '$lib/server/db';
import { buildRRule, describeFrequency } from './rrule-helpers';

const svc = await import('./recurring-series-service');

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const SERIES_ROW = {
	id: 'series-new',
	prototypeType: 'reservation',
	prototypeId: 'res-1',
	rrule: 'FREQ=WEEKLY;BYDAY=MO',
	createdAt: new Date('2026-01-01'),
	cancelledAt: null,
	supersededBy: null
};

// ---------------------------------------------------------------------------
// Transaction helper — builds a tx proxy for db.transaction mocks
// ---------------------------------------------------------------------------

// Holds references to the last tx proxy created by makeTransactionMock
const lastTx = { insertFn: null as ReturnType<typeof vi.fn> | null };

function makeTransactionMock({
	insertReturning = [SERIES_ROW],
	supersedeRowCount = 1
}: {
	insertReturning?: unknown[];
	supersedeRowCount?: number;
} = {}) {
	const returning = vi.fn().mockResolvedValue(insertReturning);
	const values = vi.fn().mockReturnValue({ returning });
	const txInsertFn = vi.fn().mockReturnValue({ values });
	lastTx.insertFn = txInsertFn;

	// updateSets captures the `set` spy from each update call so tests can inspect them
	const updateSets: ReturnType<typeof vi.fn>[] = [];

	// Each transaction invocation resets the update counter so the first update
	// (supersede old series) always uses supersedeRowCount.
	vi.mocked(db.transaction).mockImplementation((fn: (tx: unknown) => Promise<unknown>) => {
		let updateCallCount = 0;
		updateSets.length = 0;
		const txUpdateFn = vi.fn().mockImplementation(() => {
			updateCallCount++;
			const rowCount = updateCallCount === 1 ? supersedeRowCount : 1;
			const where = vi.fn().mockResolvedValue({ rowCount });
			const set = vi.fn().mockReturnValue({ where });
			updateSets.push(set);
			return { set };
		});
		return fn({ insert: txInsertFn, update: txUpdateFn }) as Promise<unknown>;
	});

	return { txInsertFn, updateSets };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('recurring-series-service', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	// -------------------------------------------------------------------------
	// create()
	// -------------------------------------------------------------------------

	describe('create()', () => {
		const params = {
			prototypeReservationId: 'res-1',
			frequency: 'weekly' as const,
			prototypeStartsAt: new Date('2026-06-01T10:00:00Z')
		};

		it('calls buildRRule with the prototype startsAt and frequency', async () => {
			makeTransactionMock();

			await svc.create(params);

			expect(buildRRule).toHaveBeenCalledWith(params.prototypeStartsAt, params.frequency);
		});

		it('inserts a recurringSeries row with rrule, type, and prototypeId', async () => {
			makeTransactionMock();

			await svc.create(params);

			// retrieve the values() spy from the chain via lastTx
			const valuesCall = lastTx.insertFn!.mock.results[0].value.values;
			expect(valuesCall).toHaveBeenCalledWith(
				expect.objectContaining({
					prototypeType: 'reservation',
					prototypeId: 'res-1',
					rrule: 'FREQ=WEEKLY;BYDAY=MO'
				})
			);
		});

		it('updates the prototype reservation with the new series id', async () => {
			const { updateSets } = makeTransactionMock();

			await svc.create(params);

			// The only update call links the prototype to the series
			expect(updateSets[0]).toHaveBeenCalledWith(
				expect.objectContaining({ recurringSeriesId: 'series-new' })
			);
		});

		it('returns the inserted series row', async () => {
			makeTransactionMock();

			const result = await svc.create(params);

			expect(result).toMatchObject({ id: 'series-new', prototypeId: 'res-1' });
		});
	});

	// -------------------------------------------------------------------------
	// edit()
	// -------------------------------------------------------------------------

	describe('edit()', () => {
		const params = {
			oldSeriesId: 'series-old',
			newPrototypeReservationId: 'res-2',
			frequency: 'weekly' as const,
			prototypeStartsAt: new Date('2026-06-08T10:00:00Z')
		};

		it('inserts a new series row for the new prototype', async () => {
			makeTransactionMock();

			await svc.edit(params);

			const valuesCall = lastTx.insertFn!.mock.results[0].value.values;
			expect(valuesCall).toHaveBeenCalledWith(
				expect.objectContaining({
					prototypeType: 'reservation',
					prototypeId: 'res-2'
				})
			);
		});

		it('marks the old series as superseded (sets supersededBy and cancelledAt)', async () => {
			const { updateSets } = makeTransactionMock();

			await svc.edit(params);

			// First update = supersede old series
			expect(updateSets[0]).toHaveBeenCalledWith(
				expect.objectContaining({ supersededBy: 'series-new' })
			);
		});

		it('returns the new series row', async () => {
			makeTransactionMock();

			const result = await svc.edit(params);

			expect(result).toMatchObject({ id: 'series-new' });
		});

		it('throws RecurringSeriesError when old series was already cancelled (rowCount=0)', async () => {
			makeTransactionMock({ supersedeRowCount: 0 });

			await expect(svc.edit(params)).rejects.toThrow(svc.RecurringSeriesError);
			await expect(svc.edit(params)).rejects.toThrow('already cancelled or superseded');
		});
	});

	// -------------------------------------------------------------------------
	// cancel()
	// -------------------------------------------------------------------------

	describe('cancel()', () => {
		function setupCancelUpdate(rowCount: number) {
			const where = vi.fn().mockResolvedValue({ rowCount });
			const set = vi.fn().mockReturnValue({ where });
			vi.mocked(db.update).mockReturnValue({ set } as ReturnType<typeof db.update>);
			return { set };
		}

		it('updates cancelledAt for the matching series', async () => {
			const { set } = setupCancelUpdate(1);

			await svc.cancel('series-1');

			expect(set).toHaveBeenCalledWith(expect.objectContaining({ cancelledAt: expect.any(Date) }));
		});

		it('throws RecurringSeriesError when series is not found or already cancelled', async () => {
			setupCancelUpdate(0);

			await expect(svc.cancel('series-missing')).rejects.toThrow(svc.RecurringSeriesError);
			await expect(svc.cancel('series-missing')).rejects.toThrow('not found or already cancelled');
		});
	});

	// -------------------------------------------------------------------------
	// cancelAllForUser()
	// -------------------------------------------------------------------------

	describe('cancelAllForUser()', () => {
		function setupSelectForUser(rows: { seriesId: string }[]) {
			const where = vi.fn().mockResolvedValue(rows);
			const innerJoin = vi.fn().mockReturnValue({ where });
			const from = vi.fn().mockReturnValue({ innerJoin });
			vi.mocked(db.select).mockReturnValue({ from } as ReturnType<typeof db.select>);
		}

		function setupUpdateForCancel(rowCount: number) {
			const where = vi.fn().mockResolvedValue({ rowCount });
			const set = vi.fn().mockReturnValue({ where });
			vi.mocked(db.update).mockReturnValue({ set } as ReturnType<typeof db.update>);
			return { set };
		}

		it('returns 0 when there are no active series for the user', async () => {
			setupSelectForUser([]);

			const count = await svc.cancelAllForUser('user-1');

			expect(count).toBe(0);
			expect(db.update).not.toHaveBeenCalled();
		});

		it('cancels all found series and returns the cancelled count', async () => {
			setupSelectForUser([{ seriesId: 'series-a' }, { seriesId: 'series-b' }]);
			const { set } = setupUpdateForCancel(2);

			const count = await svc.cancelAllForUser('user-1');

			expect(set).toHaveBeenCalledWith(expect.objectContaining({ cancelledAt: expect.any(Date) }));
			expect(count).toBe(2);
		});
	});

	// -------------------------------------------------------------------------
	// get()
	// -------------------------------------------------------------------------

	describe('get()', () => {
		function setupGetSelect(rows: unknown[]) {
			const limit = vi.fn().mockResolvedValue(rows);
			const where = vi.fn().mockReturnValue({ limit });
			const innerJoin2 = vi.fn().mockReturnValue({ where });
			const innerJoin1 = vi.fn().mockReturnValue({ innerJoin: innerJoin2 });
			const from = vi.fn().mockReturnValue({ innerJoin: innerJoin1 });
			vi.mocked(db.select).mockReturnValue({ from } as ReturnType<typeof db.select>);
		}

		it('returns null when the series does not exist', async () => {
			setupGetSelect([]);

			const result = await svc.get('series-missing');

			expect(result).toBeNull();
		});

		it('returns the series with prototype details when found', async () => {
			const row = {
				...SERIES_ROW,
				prototypeName: 'Alice',
				prototypeBookerType: 'user',
				prototypeBookerId: 'user-1',
				prototypeCreatedByUserId: 'user-1',
				prototypeStartsAt: new Date('2026-06-01T10:00:00Z'),
				prototypeEndsAt: new Date('2026-06-01T12:00:00Z'),
				prototypeNotes: null
			};
			setupGetSelect([row]);

			const result = await svc.get('series-new');

			expect(result).toMatchObject({ id: 'series-new', prototypeName: 'Alice' });
		});
	});

	// -------------------------------------------------------------------------
	// listActive()
	// -------------------------------------------------------------------------

	describe('listActive()', () => {
		function setupListSelect(rows: unknown[]) {
			const where = vi.fn().mockResolvedValue(rows);
			const innerJoin2 = vi.fn().mockReturnValue({ where });
			const innerJoin1 = vi.fn().mockReturnValue({ innerJoin: innerJoin2 });
			const from = vi.fn().mockReturnValue({ innerJoin: innerJoin1 });
			vi.mocked(db.select).mockReturnValue({ from } as ReturnType<typeof db.select>);
		}

		it('returns an empty array when there are no active series', async () => {
			setupListSelect([]);

			const result = await svc.listActive();

			expect(result).toEqual([]);
		});

		it('maps results with a frequencyLabel from describeFrequency', async () => {
			const row = {
				id: 'series-1',
				rrule: 'FREQ=WEEKLY;BYDAY=MO',
				createdAt: new Date('2026-01-01'),
				cancelledAt: null,
				userName: 'Alice',
				userPronouns: null,
				userRole: 'member',
				bookerType: 'user',
				bookerId: 'user-1',
				startsAt: new Date('2026-06-01T10:00:00Z'),
				endsAt: new Date('2026-06-01T12:00:00Z')
			};
			setupListSelect([row]);

			const result = await svc.listActive();

			expect(describeFrequency).toHaveBeenCalledWith(row.rrule);
			expect(result[0]).toMatchObject({ id: 'series-1', frequencyLabel: 'Weekly' });
		});
	});
});
