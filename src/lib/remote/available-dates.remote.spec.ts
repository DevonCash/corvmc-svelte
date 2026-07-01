import { describe, it, expect, vi } from 'vitest';
import { mockUser } from '$lib/server/db/test-factory';

// ---------------------------------------------------------------------------
// getAvailableDates must not offer a date the validator will reject.
//
// The advance-booking validator (validateBooking) rejects any start *instant*
// more than `maxAdvanceDaysOneoff * 24h` past now. The picker therefore must
// stop at `today + (maxAdvanceDaysOneoff - 1)`: offering `today + maxAdvanceDays`
// created a "dead zone" where the calendar showed a date whose later-in-the-day
// slots 500'd on Book & Pay. This test pins the aligned window.
// ---------------------------------------------------------------------------

const MAX_ADVANCE_DAYS = 14;

// Deterministic, UTC-based tz helpers so day-stepping is exact in the test.
vi.mock('$lib/server/reservation/timezone', () => ({
	formatDateInTz: vi.fn((d: Date) => d.toISOString().slice(0, 10)),
	buildDateInTz: vi.fn((date: string, time: string) => new Date(`${date}T${time}:00Z`))
}));

vi.mock('$lib/server/reservation/config', () => ({
	getReservationConfig: vi.fn(async () => ({
		maxAdvanceDaysOneoff: MAX_ADVANCE_DAYS,
		minDurationHours: 1,
		timeSlotMinutes: 30
	}))
}));

// Every day is fully available, so a day is dropped only by the window bound,
// never by lack of slots.
vi.mock('$lib/server/reservation/conflict-service', () => ({
	getAvailableSlots: vi.fn(async () => [
		{ startTime: '09:00', available: true },
		{ startTime: '09:30', available: true },
		{ startTime: '10:00', available: true },
		{ startTime: '10:30', available: true }
	]),
	getConflictDetails: vi.fn(),
	getValidationWarnings: vi.fn()
}));

const testUser = mockUser({ id: 'user-1', name: 'Test Member', email: 'member@example.com' });

vi.mock('$app/server', () => ({
	getRequestEvent: () => ({
		locals: { user: testUser },
		url: new URL('http://localhost/member/reservations'),
		request: { headers: new Headers() }
	}),
	form: (_schema: unknown, handler: (...args: any[]) => any) => {
		const fn = handler;
		(fn as any).__ = { type: 'form' };
		(fn as any).for = () => fn;
		return fn;
	},
	query: (...args: unknown[]) => {
		const handler = typeof args[0] === 'function' ? args[0] : args[1];
		const fn = handler as (...args: any[]) => any;
		(fn as any).__ = { type: 'query' };
		return fn;
	}
}));

const { getAvailableDates } = (await import('$lib/remote/reservations.remote')) as any;

describe('getAvailableDates window', () => {
	it('offers exactly maxAdvanceDaysOneoff days starting today, and no farther', async () => {
		const dates: string[] = await getAvailableDates();

		const today = new Date().toISOString().slice(0, 10);
		expect(dates[0]).toBe(today);
		// today + 0 .. today + (MAX_ADVANCE_DAYS - 1) => MAX_ADVANCE_DAYS entries.
		expect(dates).toHaveLength(MAX_ADVANCE_DAYS);

		// The last offered day must sit strictly inside the advance window so that
		// even a late-in-the-day slot validates (no dead zone).
		const lastOffered = new Date(`${dates[dates.length - 1]}T23:59:59Z`);
		const maxMs = MAX_ADVANCE_DAYS * 24 * 60 * 60 * 1000;
		expect(lastOffered.getTime() - Date.now()).toBeLessThan(maxMs);
	});
});
