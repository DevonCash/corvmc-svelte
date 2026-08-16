// Force a non-venue ambient timezone BEFORE importing the module under test.
// The venue is America/Los_Angeles, and a developer machine set to that zone
// would let every assertion below pass for the wrong reason — local and venue
// rendering would be identical. UTC makes the two disagree, which is the whole
// point of these tests.
process.env.TZ = 'UTC';

import { describe, expect, it } from 'vitest';
import { DEFAULT_TIMEZONE } from '$lib/config';
import {
	formatDate,
	formatDateLong,
	formatDateShort,
	formatDateShortYear,
	formatDateTime,
	formatDateTimeShort,
	formatDateYear,
	formatDayNumber,
	formatDayOfWeek,
	formatShortMonth,
	formatTime,
	formatTimeRange,
	fullDate,
	toLocalDate,
	toLocalTime
} from './format';

/**
 * 2026-07-04T02:30:00Z is 2026-07-03 19:30 PDT.
 *
 * Deliberately chosen so the venue and UTC disagree about the *day*, not just
 * the clock time — a bug that only shifts hours is easy to miss, one that
 * shifts the date shows up in every grouped list.
 */
const CROSSES_MIDNIGHT = new Date('2026-07-04T02:30:00Z');

/** 2026-01-15T21:00:00Z is 2026-01-15 13:00 PST — same day, standard time. */
const SAME_DAY_WINTER = new Date('2026-01-15T21:00:00Z');

describe('format.ts renders in venue time, not the viewer’s zone', () => {
	it('runs under an ambient zone that differs from the venue', () => {
		// Guards the guard: if this ever fails, every other assertion in this
		// file is meaningless because local and venue rendering coincide.
		expect(Intl.DateTimeFormat().resolvedOptions().timeZone).not.toBe(DEFAULT_TIMEZONE);
	});

	describe('when the venue date and the UTC date differ', () => {
		it('formatDate uses the venue day', () => {
			expect(formatDate(CROSSES_MIDNIGHT)).toBe('Fri, Jul 3');
		});

		it('formatDateYear uses the venue day', () => {
			expect(formatDateYear(CROSSES_MIDNIGHT)).toBe('Fri, Jul 3, 2026');
		});

		it('formatDateLong uses the venue day and omits the year', () => {
			expect(formatDateLong(CROSSES_MIDNIGHT)).toBe('Friday, July 3');
		});

		it('fullDate uses the venue day', () => {
			expect(fullDate(CROSSES_MIDNIGHT)).toBe('Friday, July 3, 2026');
		});

		it('formatDateShort uses the venue day', () => {
			expect(formatDateShort(CROSSES_MIDNIGHT)).toBe('Jul 3');
		});

		it('formatDateShortYear uses the venue day', () => {
			expect(formatDateShortYear(CROSSES_MIDNIGHT)).toBe('Jul 3, 2026');
		});

		it('formatDayOfWeek uses the venue weekday', () => {
			expect(formatDayOfWeek(CROSSES_MIDNIGHT)).toBe('FRI');
		});

		it('formatDayNumber uses the venue day of month', () => {
			expect(formatDayNumber(CROSSES_MIDNIGHT)).toBe('3');
		});

		it('formatShortMonth uses the venue month', () => {
			expect(formatShortMonth(CROSSES_MIDNIGHT)).toBe('JUL');
		});

		it('formatTime uses the venue clock', () => {
			expect(formatTime(CROSSES_MIDNIGHT)).toBe('7:30 PM');
		});

		it('formatDateTime uses the venue day and clock', () => {
			expect(formatDateTime(CROSSES_MIDNIGHT)).toBe('Fri, Jul 3, 7:30 PM');
		});

		it('formatDateTimeShort uses the venue day and clock', () => {
			expect(formatDateTimeShort(CROSSES_MIDNIGHT)).toBe('Jul 3, 7:30 PM');
		});

		it('toLocalDate emits the venue date for date inputs', () => {
			expect(toLocalDate(CROSSES_MIDNIGHT)).toBe('2026-07-03');
		});

		it('toLocalTime emits the venue time for time inputs', () => {
			expect(toLocalTime(CROSSES_MIDNIGHT)).toBe('19:30');
		});
	});

	describe('standard time (no DST offset)', () => {
		it('formatTime applies the winter offset', () => {
			expect(formatTime(SAME_DAY_WINTER)).toBe('1:00 PM');
		});

		it('formatDate is unchanged when both zones agree on the day', () => {
			expect(formatDate(SAME_DAY_WINTER)).toBe('Thu, Jan 15');
		});
	});

	describe('formatTimeRange', () => {
		it('renders both ends in venue time', () => {
			const end = new Date('2026-07-04T05:00:00Z'); // 22:00 PDT, same venue day
			expect(formatTimeRange(CROSSES_MIDNIGHT, end)).toBe('7:30 PM – 10:00 PM');
		});
	});
});
