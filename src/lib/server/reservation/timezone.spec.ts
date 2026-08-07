import { describe, it, expect } from 'vitest';
import { buildDateInTz, buildTimeRangeInTz, formatDateInTz, formatTimeInTz } from './timezone';

const TZ = 'America/Los_Angeles';

/** Round-trip helper: the built instant, re-read in the same timezone. */
function roundTrip(dateStr: string, timeStr: string): { date: string; time: string } {
	const d = buildDateInTz(dateStr, timeStr, TZ);
	return { date: formatDateInTz(d, TZ), time: formatTimeInTz(d, TZ) };
}

describe('buildDateInTz', () => {
	it('builds a mid-month date', () => {
		expect(roundTrip('2026-08-15', '19:00')).toEqual({ date: '2026-08-15', time: '19:00' });
	});

	// Regression: the UTC-offset calculation compared day-of-month across
	// timezones, so midnight on the 1st (which is still the previous month in
	// UTC-shifted terms) came back as the 1st of the PREVIOUS month — e.g.
	// 2026-08-01 00:00 PT silently became 2026-07-01. This skewed any window
	// anchored to the first of a month.
	it('builds midnight on the first of a month', () => {
		expect(roundTrip('2026-08-01', '00:00')).toEqual({ date: '2026-08-01', time: '00:00' });
	});

	it('builds midnight on New Year’s Day', () => {
		expect(roundTrip('2027-01-01', '00:00')).toEqual({ date: '2027-01-01', time: '00:00' });
	});

	it('builds a date on the spring-forward DST boundary', () => {
		expect(roundTrip('2026-03-08', '12:00')).toEqual({ date: '2026-03-08', time: '12:00' });
	});

	it('builds a date on the fall-back DST boundary', () => {
		expect(roundTrip('2026-11-01', '12:00')).toEqual({ date: '2026-11-01', time: '12:00' });
	});
});

// Regression: events and their reservations are entered as one date plus a start
// and end time, and both instants were anchored to that one date. A 9 PM – 1 AM
// show therefore ended eight hours BEFORE it started, and every save of such an
// event (any field, not just the times) died on the `ends_at > starts_at` CHECK
// constraint as a 500.
describe('buildTimeRangeInTz', () => {
	/** The built range, re-read in the same timezone. */
	function range(dateStr: string, startTime: string, endTime: string) {
		const { startsAt, endsAt } = buildTimeRangeInTz(dateStr, startTime, endTime, TZ);
		return {
			start: { date: formatDateInTz(startsAt, TZ), time: formatTimeInTz(startsAt, TZ) },
			end: { date: formatDateInTz(endsAt, TZ), time: formatTimeInTz(endsAt, TZ) },
			hours: (endsAt.getTime() - startsAt.getTime()) / 3_600_000
		};
	}

	it('rolls an end time past midnight onto the next day', () => {
		const r = range('2026-08-15', '21:00', '01:00');
		expect(r.start).toEqual({ date: '2026-08-15', time: '21:00' });
		expect(r.end).toEqual({ date: '2026-08-16', time: '01:00' });
		expect(r.hours).toBe(4);
	});

	it('keeps a same-day range on the same day', () => {
		const r = range('2026-08-15', '19:00', '22:00');
		expect(r.start).toEqual({ date: '2026-08-15', time: '19:00' });
		expect(r.end).toEqual({ date: '2026-08-15', time: '22:00' });
		expect(r.hours).toBe(3);
	});

	it('rolls across a month boundary', () => {
		expect(range('2026-08-31', '22:30', '00:30').end).toEqual({
			date: '2026-09-01',
			time: '00:30'
		});
	});

	it('rolls across a year boundary', () => {
		expect(range('2026-12-31', '21:00', '02:00').end).toEqual({
			date: '2027-01-01',
			time: '02:00'
		});
	});

	// Clocks jump 2 AM → 3 AM, so the overnight range is an hour shorter than
	// the wall-clock times suggest.
	it('rolls across the spring-forward DST boundary', () => {
		const r = range('2026-03-07', '22:00', '03:00');
		expect(r.end).toEqual({ date: '2026-03-08', time: '03:00' });
		expect(r.hours).toBe(4);
	});

	// Clocks repeat 1 AM – 2 AM, so the same range is an hour longer.
	it('rolls across the fall-back DST boundary', () => {
		const r = range('2026-10-31', '22:00', '03:00');
		expect(r.end).toEqual({ date: '2026-11-01', time: '03:00' });
		expect(r.hours).toBe(6);
	});

	// Equal times are a data-entry mistake, not a 24-hour booking — leaving them
	// as-is lets the service reject them instead of silently blocking a whole day.
	it('leaves equal start and end times alone', () => {
		const { startsAt, endsAt } = buildTimeRangeInTz('2026-08-15', '21:00', '21:00', TZ);
		expect(endsAt.getTime()).toBe(startsAt.getTime());
	});
});
