import { describe, it, expect } from 'vitest';
import { buildDateInTz, formatDateInTz, formatTimeInTz } from './timezone';

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
