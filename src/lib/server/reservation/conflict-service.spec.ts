import { describe, it, expect } from 'vitest';
import { validateBooking } from './conflict-service';

// ---------------------------------------------------------------------------
// validateBooking — pure function, no DB dependency
// ---------------------------------------------------------------------------

describe('validateBooking', () => {
	// Helper: build a Date in America/Los_Angeles for a given time
	function makeDate(dateStr: string, timeStr: string): Date {
		// Parse assuming Pacific time. In tests we just need consistent behavior.
		// We use a known date where PDT is active (summer) for predictability.
		const utc = new Date(`${dateStr}T${timeStr}:00-07:00`);
		return utc;
	}

	const date = '2025-07-15'; // A Tuesday in PDT

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
});
