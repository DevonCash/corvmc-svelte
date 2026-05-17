import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies before importing the module under test
// ---------------------------------------------------------------------------

// DB mock — we use a queue-based approach: each call to .select() or .insert()
// pops the next result from selectResults or records an insert.
let selectResults: unknown[][] = [];
let insertedRows: unknown[] = [];

function makeSelectChain(result: unknown[]) {
	// Builds a fluent chain that resolves to result whether you call:
	//   .from().where()          (active series — no .limit())
	//   .from().where().limit()  (prototype, owner, existing instances)
	//   .from().where().limit()  (conflict checks)
	const limit = vi.fn().mockResolvedValue(result);
	// Make `where` thenable so `await .where()` works without `.limit()`
	const where = vi.fn().mockReturnValue(
		Object.assign(Promise.resolve(result), { limit })
	);
	const from = vi.fn().mockReturnValue({ where, limit });
	return { from };
}

const dbMock = {
	select: vi.fn(),
	insert: vi.fn()
};

vi.mock('$lib/server/db', () => ({ db: dbMock }));

// Schema refs — just need to be truthy objects used in eq/and calls
vi.mock('$lib/server/db/schema/recurring', () => ({
	recurringSeries: { id: 'id', prototypeId: 'prototypeId', rrule: 'rrule', prototypeType: 'prototypeType', cancelledAt: 'cancelledAt', supersededBy: 'supersededBy' }
}));

vi.mock('$lib/server/db/schema/reservation', () => ({
	reservation: { id: 'id', bookerType: 'bookerType', bookerId: 'bookerId', createdByUserId: 'createdByUserId', startsAt: 'startsAt', endsAt: 'endsAt', notes: 'notes', recurringSeriesId: 'recurringSeriesId', status: 'status' },
	closure: { reason: 'reason', startsAt: 'startsAt', endsAt: 'endsAt' }
}));

vi.mock('$lib/server/db/schema/auth', () => ({
	user: { id: 'id', name: 'name', email: 'email' }
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn(),
	and: vi.fn(),
	isNull: vi.fn(),
	lt: vi.fn(),
	gt: vi.fn(),
	gte: vi.fn(),
	lte: vi.fn(),
	ne: vi.fn()
}));

const mockGetOccurrences = vi.fn();
const mockGenerationWindowEnd = vi.fn();

vi.mock('./rrule-helpers', () => ({
	getOccurrences: (...args: unknown[]) => mockGetOccurrences(...args),
	generationWindowEnd: (...args: unknown[]) => mockGenerationWindowEnd(...args)
}));

vi.mock('./timezone', () => ({
	formatDateInTz: vi.fn().mockReturnValue('May 15'),
	formatTimeInTz: vi.fn().mockReturnValue('10:00 AM')
}));

const mockEmit = vi.fn().mockResolvedValue(undefined);

vi.mock('$lib/server/events/event-bus', () => ({
	domainEvents: { emit: (...args: unknown[]) => mockEmit(...args) }
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const OCC1 = new Date('2026-05-20T17:00:00Z'); // occurrence start
const OCC1_END = new Date('2026-05-20T19:00:00Z'); // +2h

const PROTOTYPE = {
	bookerType: 'user',
	bookerId: 'user-1',
	createdByUserId: 'user-1',
	startsAt: new Date('2026-05-13T17:00:00Z'),
	endsAt: new Date('2026-05-13T19:00:00Z'), // 2h duration
	notes: 'Weekly practice'
};

const OWNER = { name: 'Alice Smith', email: 'alice@example.com' };

const SERIES = { id: 'series-1', prototypeId: 'proto-1', rrule: 'FREQ=WEEKLY' };

/** Push results onto the select queue in the order processSeries calls them */
function queueSelects(...results: unknown[][]) {
	selectResults = [...results];
	dbMock.select.mockImplementation(() => {
		const result = selectResults.shift() ?? [];
		return makeSelectChain(result);
	});
}

function setupInsert() {
	const values = vi.fn().mockImplementation((row: unknown) => {
		insertedRows.push(row);
		return Promise.resolve();
	});
	dbMock.insert.mockReturnValue({ values });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateRecurringReservations', () => {
	beforeEach(() => {
		vi.resetAllMocks();
		selectResults = [];
		insertedRows = [];
		mockEmit.mockResolvedValue(undefined);
		mockGenerationWindowEnd.mockReturnValue(new Date('2026-06-20T00:00:00Z'));
	});

	it('returns zeros when no active series exist', async () => {
		// Only one select: the active series query → empty
		queueSelects([]);
		setupInsert();
		mockGetOccurrences.mockReturnValue([]);

		const { generateRecurringReservations } = await import('./generation-job');
		const result = await generateRecurringReservations();

		expect(result).toEqual({
			seriesProcessed: 0,
			instancesCreated: 0,
			instancesSkipped: 0,
			errors: []
		});
	});

	it('creates reservation instances for occurrences with no conflicts', async () => {
		// Selects: activeSeries, prototype, owner, existingInstances, eventConflict, closureConflict
		queueSelects(
			[SERIES],        // 1. active series
			[PROTOTYPE],     // 2. prototype reservation
			[OWNER],         // 3. user/owner info
			[],              // 4. existing instances in window (none)
			[],              // 5. event conflict check (none)
			[]               // 6. closure conflict check (none)
		);
		setupInsert();
		mockGetOccurrences.mockReturnValue([OCC1]);

		const { generateRecurringReservations } = await import('./generation-job');
		const result = await generateRecurringReservations();

		expect(result.seriesProcessed).toBe(1);
		expect(result.instancesCreated).toBe(1);
		expect(result.instancesSkipped).toBe(0);
		expect(result.errors).toHaveLength(0);
		expect(insertedRows).toHaveLength(1);
		expect(insertedRows[0]).toMatchObject({
			bookerType: PROTOTYPE.bookerType,
			bookerId: PROTOTYPE.bookerId,
			createdByUserId: PROTOTYPE.createdByUserId,
			status: 'scheduled',
			startsAt: OCC1,
			endsAt: OCC1_END,
			notes: PROTOTYPE.notes,
			recurringSeriesId: SERIES.id
		});
	});

	it('skips occurrences that already exist (dedup)', async () => {
		// existingInstances returns OCC1 → it already exists
		queueSelects(
			[SERIES],
			[PROTOTYPE],
			[OWNER],
			[{ startsAt: OCC1 }] // 4. existing instance matches OCC1
			// No conflict-check selects because we short-circuit on dedup
		);
		setupInsert();
		mockGetOccurrences.mockReturnValue([OCC1]);

		const { generateRecurringReservations } = await import('./generation-job');
		const result = await generateRecurringReservations();

		expect(result.instancesCreated).toBe(0);
		expect(result.instancesSkipped).toBe(0); // deduped, not counted as skipped
		expect(insertedRows).toHaveLength(0);
	});

	it('skips occurrences with event conflicts and emits recurring_skipped event', async () => {
		queueSelects(
			[SERIES],
			[PROTOTYPE],
			[OWNER],
			[],                      // 4. no existing instances
			[{ id: 'event-1' }],     // 5. event conflict found
			[]                       // closure check (not reached, but queue is safe)
		);
		setupInsert();
		mockGetOccurrences.mockReturnValue([OCC1]);

		const { generateRecurringReservations } = await import('./generation-job');
		const result = await generateRecurringReservations();

		expect(result.instancesCreated).toBe(0);
		expect(result.instancesSkipped).toBe(1);
		expect(insertedRows).toHaveLength(0);

		expect(mockEmit).toHaveBeenCalledOnce();
		expect(mockEmit).toHaveBeenCalledWith(
			'reservation.recurring_skipped',
			expect.objectContaining({
				seriesId: SERIES.id,
				userId: PROTOTYPE.createdByUserId,
				userName: OWNER.name,
				userEmail: OWNER.email,
				reason: 'Scheduled event'
			})
		);
	});

	it('skips occurrences with closure conflicts', async () => {
		queueSelects(
			[SERIES],
			[PROTOTYPE],
			[OWNER],
			[],                                       // 4. no existing instances
			[],                                       // 5. no event conflict
			[{ reason: 'Holiday closure' }]           // 6. closure conflict
		);
		setupInsert();
		mockGetOccurrences.mockReturnValue([OCC1]);

		const { generateRecurringReservations } = await import('./generation-job');
		const result = await generateRecurringReservations();

		expect(result.instancesCreated).toBe(0);
		expect(result.instancesSkipped).toBe(1);
		expect(insertedRows).toHaveLength(0);

		expect(mockEmit).toHaveBeenCalledOnce();
		expect(mockEmit).toHaveBeenCalledWith(
			'reservation.recurring_skipped',
			expect.objectContaining({ reason: 'Holiday closure' })
		);
	});

	it('catches per-series errors without stopping other series', async () => {
		const SERIES_2 = { id: 'series-2', prototypeId: 'proto-2', rrule: 'FREQ=WEEKLY' };
		const OCC2 = new Date('2026-05-21T17:00:00Z');
		const OCC2_END = new Date('2026-05-21T19:00:00Z');

		queueSelects(
			[SERIES, SERIES_2],  // 1. two active series
			[],                  // 2. prototype for series-1 → missing → throws
			// series-2 processing:
			[PROTOTYPE],         // 3. prototype for series-2
			[OWNER],             // 4. owner for series-2
			[],                  // 5. no existing instances
			[],                  // 6. no event conflict for OCC2
			[]                   // 7. no closure conflict for OCC2
		);
		setupInsert();

		// series-1 gets no occurrences because it throws before reaching getOccurrences
		// series-2 gets one occurrence
		mockGetOccurrences
			.mockReturnValueOnce([OCC2]); // called only for series-2

		const { generateRecurringReservations } = await import('./generation-job');
		const result = await generateRecurringReservations();

		expect(result.seriesProcessed).toBe(1);
		expect(result.instancesCreated).toBe(1);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]).toContain('series-1');
		expect(result.errors[0]).toContain('Prototype reservation not found');

		expect(insertedRows).toHaveLength(1);
		expect(insertedRows[0]).toMatchObject({
			startsAt: OCC2,
			endsAt: OCC2_END,
			recurringSeriesId: SERIES_2.id
		});
	});

	it('handles missing prototype gracefully (adds to errors)', async () => {
		queueSelects(
			[SERIES],  // 1. one active series
			[]         // 2. prototype query → empty → throws
		);
		setupInsert();
		// getOccurrences should not be called; no need to configure it

		const { generateRecurringReservations } = await import('./generation-job');
		const result = await generateRecurringReservations();

		expect(result.seriesProcessed).toBe(0);
		expect(result.instancesCreated).toBe(0);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]).toMatch(/series-1.*Prototype reservation not found/);
		expect(mockEmit).not.toHaveBeenCalled();
	});
});
