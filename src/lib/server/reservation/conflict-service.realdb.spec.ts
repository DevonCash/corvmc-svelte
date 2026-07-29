import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	createTestDb,
	insertUser,
	insertReservation,
	insertClosure,
	type TestDb
} from '$lib/server/db/test-db';

// Only the KV-backed reservation config is mocked — everything else runs against
// a real in-memory SQLite so the actual overlap SQL is executed. `bufferMinutes`
// is overridable per-test via the mutable `config` object below.
const config = {
	timeSlotMinutes: 30,
	minDurationHours: 1,
	maxDurationHours: 8,
	operatingHoursStart: '09:00',
	operatingHoursEnd: '22:00',
	bufferMinutes: 0,
	minAdvanceMinutes: 60,
	maxAdvanceDaysOneoff: 14,
	maxAdvanceDaysRecurring: 17.5
};
vi.mock('./config', () => ({
	getReservationConfig: vi.fn(async () => config)
}));

import { hasConflict, getAvailableSlots, getConflictDetails } from './conflict-service';

let ctx: TestDb;
let ownerId: string;

// A Tuesday. Times are in America/Los_Angeles (PDT = -07:00) to match the app tz.
const at = (time: string) => new Date(`2026-07-14T${time}:00-07:00`);

beforeEach(async () => {
	ctx = createTestDb();
	config.bufferMinutes = 0;
	const owner = await insertUser(ctx.db, { name: 'Alice Owner' });
	ownerId = owner.id;
});

afterEach(() => ctx.close());

describe('hasConflict (real SQL overlap predicate)', () => {
	it('is true when the proposed range overlaps an existing reservation', async () => {
		await insertReservation(ctx.db, {
			createdByUserId: ownerId,
			startsAt: at('18:00'),
			endsAt: at('20:00')
		});

		expect(await hasConflict(at('19:00'), at('21:00'))).toBe(true);
	});

	it('is false when the proposed range is exactly adjacent (touching edges do not overlap)', async () => {
		await insertReservation(ctx.db, {
			createdByUserId: ownerId,
			startsAt: at('18:00'),
			endsAt: at('20:00')
		});

		// New booking starts exactly when the existing one ends.
		expect(await hasConflict(at('20:00'), at('22:00'))).toBe(false);
	});

	it('ignores cancelled and waitlisted reservations', async () => {
		await insertReservation(ctx.db, {
			createdByUserId: ownerId,
			startsAt: at('18:00'),
			endsAt: at('20:00'),
			status: 'cancelled'
		});
		await insertReservation(ctx.db, {
			createdByUserId: ownerId,
			startsAt: at('18:00'),
			endsAt: at('20:00'),
			status: 'waitlisted'
		});

		expect(await hasConflict(at('18:30'), at('19:30'))).toBe(false);
	});

	it('excludes the reservation being edited via excludeReservationId', async () => {
		const existing = await insertReservation(ctx.db, {
			createdByUserId: ownerId,
			startsAt: at('18:00'),
			endsAt: at('20:00')
		});

		expect(await hasConflict(at('18:00'), at('20:00'))).toBe(true);
		expect(await hasConflict(at('18:00'), at('20:00'), existing.id)).toBe(false);
	});

	it('applies the configured buffer so back-to-back bookings within the buffer conflict', async () => {
		await insertReservation(ctx.db, {
			createdByUserId: ownerId,
			startsAt: at('18:00'),
			endsAt: at('20:00')
		});

		// Adjacent booking: no conflict at 0 buffer, conflict once a 30-min buffer applies.
		expect(await hasConflict(at('20:00'), at('21:00'))).toBe(false);
		config.bufferMinutes = 30;
		expect(await hasConflict(at('20:00'), at('21:00'))).toBe(true);
	});

	it('is true when a closure overlaps the proposed range', async () => {
		await insertClosure(ctx.db, {
			startsAt: at('17:00'),
			endsAt: at('23:00'),
			reason: 'Private event'
		});

		expect(await hasConflict(at('18:00'), at('19:00'))).toBe(true);
	});
});

describe('getAvailableSlots (real reservation/closure rows)', () => {
	// Availability depends on "now" (a slot must be at least minAdvance in the
	// future), so pin the clock to the morning of the test day.
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(at('08:00'));
	});
	afterEach(() => vi.useRealTimers());

	it('marks slots overlapping a booking unavailable and leaves others open', async () => {
		await insertReservation(ctx.db, {
			createdByUserId: ownerId,
			startsAt: at('18:00'),
			endsAt: at('19:00')
		});

		const slots = await getAvailableSlots('2026-07-14');
		const booked = slots.find((s) => s.startTime === '18:00');
		const open = slots.find((s) => s.startTime === '20:00');

		expect(booked?.available).toBe(false);
		expect(open?.available).toBe(true);
	});

	it('marks slots inside a closure unavailable', async () => {
		await insertClosure(ctx.db, {
			startsAt: at('18:00'),
			endsAt: at('19:00'),
			reason: 'Cleaning'
		});

		const slots = await getAvailableSlots('2026-07-14');
		expect(slots.find((s) => s.startTime === '18:00')?.available).toBe(false);
	});
});

describe('getConflictDetails (real join to user)', () => {
	it('returns the booking with the reserving member name', async () => {
		await insertReservation(ctx.db, {
			createdByUserId: ownerId,
			startsAt: at('18:00'),
			endsAt: at('20:00')
		});

		const details = await getConflictDetails(at('19:00'), at('21:00'));
		expect(details).toHaveLength(1);
		expect(details[0]).toMatchObject({ type: 'reservation', label: 'Alice Owner' });
	});

	it('returns closure details with the reason as the label', async () => {
		await insertClosure(ctx.db, {
			startsAt: at('17:00'),
			endsAt: at('23:00'),
			reason: 'Holiday'
		});

		const details = await getConflictDetails(at('18:00'), at('19:00'));
		expect(details.some((d) => d.type === 'closure' && d.label === 'Holiday')).toBe(true);
	});
});
