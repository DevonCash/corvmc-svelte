import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let selectResultQueue: unknown[][] = [];

function chainable() {
	const proxy: any = new Proxy(() => proxy, {
		get(_, prop) {
			if (prop === 'then') {
				return (resolve: (v: unknown[]) => void) => {
					if (selectResultQueue.length > 0) return resolve(selectResultQueue.shift()!);
					return resolve([]);
				};
			}
			return () => proxy;
		}
	});
	return proxy;
}

vi.mock('$lib/server/db', () => ({
	db: {
		select: vi.fn(() => chainable())
	}
}));

vi.mock('drizzle-orm', async (importOriginal) => {
	const actual = await importOriginal<typeof import('drizzle-orm')>();
	return {
		...actual,
		and: (...args: unknown[]) => args,
		ne: () => 'ne',
		eq: () => 'eq',
		lt: () => 'lt',
		gt: () => 'gt'
	};
});

import {
	hasConflict,
	getAvailableSlots,
	validateBooking,
	getConflictDetails,
	getValidationWarnings
} from './conflict-service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDate(dateStr: string, timeStr: string): Date {
	const utc = new Date(`${dateStr}T${timeStr}:00-07:00`);
	return utc;
}

const date = '2025-07-15'; // A Tuesday in PDT

beforeEach(() => {
	selectResultQueue = [];
});

// ---------------------------------------------------------------------------
// validateBooking — pure function, no DB dependency
// ---------------------------------------------------------------------------

describe('validateBooking', () => {
	it('accepts a valid 1-hour booking within operating hours', () => {
		const result = validateBooking(makeDate(date, '10:00'), makeDate(date, '11:00'));
		expect(result).toEqual({ valid: true });
	});

	it('accepts a valid 8-hour booking', () => {
		const result = validateBooking(makeDate(date, '09:00'), makeDate(date, '17:00'));
		expect(result).toEqual({ valid: true });
	});

	it('accepts a booking ending exactly at operating hours end', () => {
		const result = validateBooking(makeDate(date, '21:00'), makeDate(date, '22:00'));
		expect(result).toEqual({ valid: true });
	});

	it('rejects end time before start time', () => {
		const result = validateBooking(makeDate(date, '11:00'), makeDate(date, '10:00'));
		expect(result.valid).toBe(false);
		expect(result.error).toContain('after start time');
	});

	it('rejects duration shorter than minimum', () => {
		const result = validateBooking(makeDate(date, '10:00'), makeDate(date, '10:30'));
		expect(result.valid).toBe(false);
		expect(result.error).toContain('Minimum duration');
	});

	it('rejects duration longer than maximum', () => {
		const result = validateBooking(makeDate(date, '09:00'), makeDate(date, '18:00'));
		expect(result.valid).toBe(false);
		expect(result.error).toContain('Maximum duration');
	});

	it('rejects start time not on 30-minute boundary', () => {
		const result = validateBooking(makeDate(date, '10:15'), makeDate(date, '11:15'));
		expect(result.valid).toBe(false);
		expect(result.error).toContain('30-minute boundaries');
	});

	it('rejects start time before operating hours', () => {
		const result = validateBooking(makeDate(date, '08:00'), makeDate(date, '09:00'));
		expect(result.valid).toBe(false);
		expect(result.error).toContain('Cannot start before');
	});

	it('rejects end time after operating hours', () => {
		const result = validateBooking(makeDate(date, '21:00'), makeDate(date, '23:00'));
		expect(result.valid).toBe(false);
		expect(result.error).toContain('Cannot end after');
	});

	it('accepts half-hour boundaries', () => {
		const result = validateBooking(makeDate(date, '10:30'), makeDate(date, '12:00'));
		expect(result).toEqual({ valid: true });
	});

	it('rejects booking too far in advance (one-off)', () => {
		const farFuture = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // 15 days ahead
		// Align to 10:00 Pacific time on that date
		const dateStr = farFuture.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
		const start = makeDate(dateStr, '10:00');
		const end = makeDate(dateStr, '11:00');
		const result = validateBooking(start, end);
		expect(result.valid).toBe(false);
		expect(result.error).toContain('14 days in advance');
	});

	it('accepts booking within recurring advance window', () => {
		const future = new Date(Date.now() + 16 * 24 * 60 * 60 * 1000); // 16 days ahead
		const dateStr = future.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
		const start = makeDate(dateStr, '10:00');
		const end = makeDate(dateStr, '11:00');
		const result = validateBooking(start, end, { isRecurring: true });
		expect(result).toEqual({ valid: true });
	});
});

// ---------------------------------------------------------------------------
// hasConflict — async, uses mocked DB
// ---------------------------------------------------------------------------

describe('hasConflict', () => {
	it('returns false when no reservations or closures conflict', async () => {
		selectResultQueue = [[], []]; // reservations query, closures query
		const result = await hasConflict(makeDate(date, '10:00'), makeDate(date, '11:00'));
		expect(result).toBe(false);
	});

	it('returns true when a reservation conflicts', async () => {
		selectResultQueue = [[{ id: 'res-1' }]]; // reservation found
		const result = await hasConflict(makeDate(date, '10:00'), makeDate(date, '11:00'));
		expect(result).toBe(true);
	});

	it('returns true when a closure conflicts', async () => {
		selectResultQueue = [[], [{ id: 'closure-1' }]];
		const result = await hasConflict(makeDate(date, '10:00'), makeDate(date, '11:00'));
		expect(result).toBe(true);
	});

	it('accepts excludeReservationId parameter', async () => {
		selectResultQueue = [[], []];
		const result = await hasConflict(
			makeDate(date, '10:00'),
			makeDate(date, '11:00'),
			'exclude-id'
		);
		expect(result).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// getAvailableSlots — async, uses mocked DB
// ---------------------------------------------------------------------------

describe('getAvailableSlots', () => {
	it('returns slots within operating hours when no reservations or closures', async () => {
		selectResultQueue = [[], []]; // day reservations, day closures
		const slots = await getAvailableSlots(makeDate(date, '12:00'));
		// Operating hours 09:00 - 22:00 = 13 hours = 26 half-hour slots
		expect(slots).toHaveLength(26);
		expect(slots[0].startTime).toBe('09:00');
		expect(slots[0].available).toBe(true);
		expect(slots[25].endTime).toBe('22:00');
		expect(slots[25].available).toBe(true);
	});

	it('marks slots overlapping a reservation as unavailable', async () => {
		const resStart = makeDate(date, '10:00');
		const resEnd = makeDate(date, '11:00');
		selectResultQueue = [
			[{ startsAt: resStart, endsAt: resEnd }], // reservations
			[] // closures
		];
		const slots = await getAvailableSlots(makeDate(date, '12:00'));
		// Slots at 10:00 and 10:30 should be blocked
		const slot1000 = slots.find((s) => s.startTime === '10:00');
		const slot1030 = slots.find((s) => s.startTime === '10:30');
		expect(slot1000?.available).toBe(false);
		expect(slot1030?.available).toBe(false);
		// Slot at 09:00 should be free
		const slot0900 = slots.find((s) => s.startTime === '09:00');
		expect(slot0900?.available).toBe(true);
	});

	it('marks slots overlapping a closure as unavailable', async () => {
		const closureStart = makeDate(date, '14:00');
		const closureEnd = makeDate(date, '15:30');
		selectResultQueue = [
			[], // reservations
			[{ startsAt: closureStart, endsAt: closureEnd }] // closures
		];
		const slots = await getAvailableSlots(makeDate(date, '12:00'));
		const slot1400 = slots.find((s) => s.startTime === '14:00');
		const slot1430 = slots.find((s) => s.startTime === '14:30');
		const slot1500 = slots.find((s) => s.startTime === '15:00');
		expect(slot1400?.available).toBe(false);
		expect(slot1430?.available).toBe(false);
		expect(slot1500?.available).toBe(false);
		// Slot before closure should be available
		const slot1330 = slots.find((s) => s.startTime === '13:30');
		expect(slot1330?.available).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// getConflictDetails — async, uses mocked DB
// ---------------------------------------------------------------------------

describe('getConflictDetails', () => {
	it('returns empty array when no conflicts exist', async () => {
		selectResultQueue = [[], []];
		const details = await getConflictDetails(makeDate(date, '10:00'), makeDate(date, '11:00'));
		expect(details).toEqual([]);
	});

	it('returns reservation conflict details', async () => {
		const resStart = makeDate(date, '10:00');
		const resEnd = makeDate(date, '11:00');
		selectResultQueue = [
			[{ startsAt: resStart, endsAt: resEnd, userName: 'Alice' }],
			[]
		];
		const details = await getConflictDetails(makeDate(date, '10:00'), makeDate(date, '11:00'));
		expect(details).toHaveLength(1);
		expect(details[0]).toEqual({
			type: 'reservation',
			startsAt: resStart,
			endsAt: resEnd,
			label: 'Alice'
		});
	});

	it('returns closure conflict details', async () => {
		const closureStart = makeDate(date, '14:00');
		const closureEnd = makeDate(date, '16:00');
		selectResultQueue = [
			[],
			[{ startsAt: closureStart, endsAt: closureEnd, reason: 'Maintenance' }]
		];
		const details = await getConflictDetails(makeDate(date, '14:00'), makeDate(date, '16:00'));
		expect(details).toHaveLength(1);
		expect(details[0]).toEqual({
			type: 'closure',
			startsAt: closureStart,
			endsAt: closureEnd,
			label: 'Maintenance'
		});
	});

	it('returns both reservation and closure conflicts', async () => {
		const resStart = makeDate(date, '10:00');
		const resEnd = makeDate(date, '11:00');
		const closureStart = makeDate(date, '10:30');
		const closureEnd = makeDate(date, '11:30');
		selectResultQueue = [
			[{ startsAt: resStart, endsAt: resEnd, userName: 'Bob' }],
			[{ startsAt: closureStart, endsAt: closureEnd, reason: 'Emergency' }]
		];
		const details = await getConflictDetails(makeDate(date, '10:00'), makeDate(date, '12:00'));
		expect(details).toHaveLength(2);
		expect(details[0].type).toBe('reservation');
		expect(details[1].type).toBe('closure');
	});
});

// ---------------------------------------------------------------------------
// getValidationWarnings — pure function, no DB dependency
// ---------------------------------------------------------------------------

describe('getValidationWarnings', () => {
	it('returns empty array for valid booking', () => {
		const warnings = getValidationWarnings(makeDate(date, '10:00'), makeDate(date, '11:00'));
		expect(warnings).toEqual([]);
	});

	it('returns early if end time is before start time', () => {
		const warnings = getValidationWarnings(makeDate(date, '11:00'), makeDate(date, '10:00'));
		expect(warnings).toEqual(['End time must be after start time']);
	});

	it('warns about duration below minimum', () => {
		const warnings = getValidationWarnings(makeDate(date, '10:00'), makeDate(date, '10:30'));
		expect(warnings).toContainEqual(expect.stringContaining('1-hour minimum'));
	});

	it('warns about duration above maximum', () => {
		const warnings = getValidationWarnings(makeDate(date, '09:00'), makeDate(date, '18:00'));
		expect(warnings).toContainEqual(expect.stringContaining('8-hour maximum'));
	});

	it('warns about non-30-minute boundaries', () => {
		const warnings = getValidationWarnings(makeDate(date, '10:15'), makeDate(date, '11:15'));
		expect(warnings).toContainEqual(expect.stringContaining('30-minute boundaries'));
	});

	it('warns about outside operating hours (start too early)', () => {
		const warnings = getValidationWarnings(makeDate(date, '08:00'), makeDate(date, '09:00'));
		expect(warnings).toContainEqual(expect.stringContaining('operating hours'));
	});

	it('warns about outside operating hours (end too late)', () => {
		const warnings = getValidationWarnings(makeDate(date, '21:00'), makeDate(date, '23:00'));
		expect(warnings).toContainEqual(expect.stringContaining('operating hours'));
	});

	it('warns about too far in advance (one-off)', () => {
		const farFuture = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
		const dateStr = farFuture.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
		const start = makeDate(dateStr, '10:00');
		const end = makeDate(dateStr, '11:00');
		const warnings = getValidationWarnings(start, end);
		expect(warnings).toContainEqual(expect.stringContaining('14 days in advance'));
	});

	it('uses recurring window when isRecurring is true', () => {
		const future = new Date(Date.now() + 16 * 24 * 60 * 60 * 1000);
		const dateStr = future.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
		const start = makeDate(dateStr, '10:00');
		const end = makeDate(dateStr, '11:00');
		const warnings = getValidationWarnings(start, end, { isRecurring: true });
		// 16 days is within recurring window of 17.5 days
		const advanceWarning = warnings.find((w) => w.includes('days in advance'));
		expect(advanceWarning).toBeUndefined();
	});

	it('warns about recurring too far in advance', () => {
		const farFuture = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
		const dateStr = farFuture.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
		const start = makeDate(dateStr, '10:00');
		const end = makeDate(dateStr, '11:00');
		const warnings = getValidationWarnings(start, end, { isRecurring: true });
		expect(warnings).toContainEqual(expect.stringContaining('17.5 days in advance'));
	});

	it('can accumulate multiple warnings', () => {
		// Too short + not on boundary + outside operating hours
		const warnings = getValidationWarnings(makeDate(date, '08:15'), makeDate(date, '08:45'));
		expect(warnings.length).toBeGreaterThanOrEqual(2);
	});
});
