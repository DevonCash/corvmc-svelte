import { describe, it, expect } from 'vitest';
import {
	buildRRule,
	parseRRule,
	getOccurrences,
	generationWindowEnd,
	describeFrequency
} from './rrule-helpers';

describe('buildRRule', () => {
	it('generates a weekly RRULE with correct BYDAY for a Tuesday', () => {
		// 2026-05-12 is a Tuesday, 10:00 AM Pacific
		const start = new Date('2026-05-12T17:00:00.000Z'); // 10:00 AM PDT
		const result = buildRRule(start, 'weekly');

		expect(result).toContain('FREQ=WEEKLY');
		expect(result).toContain('INTERVAL=1');
		expect(result).toContain('BYDAY=TU');
		expect(result).toContain('TZID=America/Los_Angeles');
	});

	it('generates a biweekly RRULE with interval 2', () => {
		const start = new Date('2026-05-12T17:00:00.000Z');
		const result = buildRRule(start, 'biweekly');

		expect(result).toContain('FREQ=WEEKLY');
		expect(result).toContain('INTERVAL=2');
		expect(result).toContain('BYDAY=TU');
	});

	it('generates a monthly RRULE with nth weekday for the 2nd Tuesday', () => {
		// 2026-05-12 is the 2nd Tuesday of May (day 12, ceil(12/7)=2)
		const start = new Date('2026-05-12T17:00:00.000Z');
		const result = buildRRule(start, 'monthly');

		expect(result).toContain('FREQ=MONTHLY');
		expect(result).toContain('INTERVAL=1');
		// nth weekday notation: +2TU means 2nd Tuesday
		expect(result).toMatch(/BYDAY=\+?2TU/);
	});

	it('generates a monthly RRULE with nth weekday for the 3rd Wednesday', () => {
		// 2026-05-20 is a Wednesday, day 20, ceil(20/7)=3 → 3rd Wednesday
		const start = new Date('2026-05-20T17:00:00.000Z');
		const result = buildRRule(start, 'monthly');

		expect(result).toContain('FREQ=MONTHLY');
		expect(result).toMatch(/BYDAY=\+?3WE/);
	});

	it('generates a weekly RRULE for a Sunday', () => {
		// 2026-05-17 is a Sunday
		const start = new Date('2026-05-17T19:00:00.000Z'); // 12:00 PM PDT
		const result = buildRRule(start, 'weekly');

		expect(result).toContain('BYDAY=SU');
	});

	it('generates a weekly RRULE for a Saturday', () => {
		// 2026-05-16 is a Saturday (Friday in some TZs, but 10am PDT = 17:00 UTC)
		const start = new Date('2026-05-16T17:00:00.000Z'); // 10:00 AM PDT on Saturday May 16
		const result = buildRRule(start, 'weekly');

		expect(result).toContain('BYDAY=SA');
	});

	it('includes DTSTART in the output', () => {
		const start = new Date('2026-05-12T17:00:00.000Z');
		const result = buildRRule(start, 'weekly');

		expect(result).toContain('DTSTART');
	});
});

describe('parseRRule', () => {
	it('round-trips a built RRULE string', () => {
		const start = new Date('2026-05-12T17:00:00.000Z');
		const rruleString = buildRRule(start, 'weekly');
		const rule = parseRRule(rruleString);

		expect(rule).toBeDefined();
		expect(rule.options.freq).toBeDefined();
	});

	it('parses a manually constructed RRULE string', () => {
		const rruleString =
			'DTSTART;TZID=America/Los_Angeles:20260512T100000\nRRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=TU';
		const rule = parseRRule(rruleString);

		expect(rule).toBeDefined();
	});
});

describe('getOccurrences', () => {
	it('returns occurrences within the given window for a weekly rule', () => {
		const start = new Date('2026-05-12T17:00:00.000Z');
		const rruleString = buildRRule(start, 'weekly');

		const after = new Date('2026-05-12T00:00:00.000Z');
		const before = new Date('2026-06-12T00:00:00.000Z');

		const occurrences = getOccurrences(rruleString, after, before);

		// ~4-5 Tuesdays in a month window
		expect(occurrences.length).toBeGreaterThanOrEqual(4);
		expect(occurrences.length).toBeLessThanOrEqual(5);

		// All occurrences should be Date objects
		for (const occ of occurrences) {
			expect(occ).toBeInstanceOf(Date);
		}
	});

	it('returns occurrences within the given window for a biweekly rule', () => {
		const start = new Date('2026-05-12T17:00:00.000Z');
		const rruleString = buildRRule(start, 'biweekly');

		const after = new Date('2026-05-12T00:00:00.000Z');
		const before = new Date('2026-06-12T00:00:00.000Z');

		const occurrences = getOccurrences(rruleString, after, before);

		// Biweekly in a month = ~2 occurrences
		expect(occurrences.length).toBeGreaterThanOrEqual(2);
		expect(occurrences.length).toBeLessThanOrEqual(3);
	});

	it('returns occurrences within the given window for a monthly rule', () => {
		const start = new Date('2026-05-12T17:00:00.000Z');
		const rruleString = buildRRule(start, 'monthly');

		const after = new Date('2026-05-12T00:00:00.000Z');
		const before = new Date('2026-08-12T00:00:00.000Z');

		const occurrences = getOccurrences(rruleString, after, before);

		// 3 months = 2-4 occurrences depending on nth-weekday alignment
		expect(occurrences.length).toBeGreaterThanOrEqual(2);
		expect(occurrences.length).toBeLessThanOrEqual(4);
	});

	it('returns empty array when window has no occurrences', () => {
		const start = new Date('2026-05-12T17:00:00.000Z');
		const rruleString = buildRRule(start, 'weekly');

		// Window before the DTSTART
		const after = new Date('2026-01-01T00:00:00.000Z');
		const before = new Date('2026-01-07T00:00:00.000Z');

		const occurrences = getOccurrences(rruleString, after, before);
		expect(occurrences).toHaveLength(0);
	});

	it('excludes boundary dates (exclusive window)', () => {
		const start = new Date('2026-05-12T17:00:00.000Z');
		const rruleString = buildRRule(start, 'weekly');

		// Use exact occurrence time as boundary — should be excluded
		const after = new Date('2026-05-12T17:00:00.000Z');
		const before = new Date('2026-05-19T17:00:00.000Z');

		const occurrences = getOccurrences(rruleString, after, before);

		// Both boundaries are exclusive, so neither May 12 nor May 19 should be included
		for (const occ of occurrences) {
			expect(occ.getTime()).not.toBe(after.getTime());
			expect(occ.getTime()).not.toBe(before.getTime());
		}
	});
});

describe('generationWindowEnd', () => {
	it('returns a date MAX_ADVANCE_DAYS_RECURRING days in the future', () => {
		const from = new Date('2026-05-12T00:00:00.000Z');
		const result = generationWindowEnd(from);

		const expectedMs = from.getTime() + 17.5 * 24 * 60 * 60 * 1000;
		expect(result.getTime()).toBe(expectedMs);
	});

	it('defaults to current time when no argument is given', () => {
		const before = new Date();
		const result = generationWindowEnd();
		const after = new Date();

		const minExpected = before.getTime() + 17.5 * 24 * 60 * 60 * 1000;
		const maxExpected = after.getTime() + 17.5 * 24 * 60 * 60 * 1000;

		expect(result.getTime()).toBeGreaterThanOrEqual(minExpected);
		expect(result.getTime()).toBeLessThanOrEqual(maxExpected);
	});
});

describe('describeFrequency', () => {
	it('returns "Weekly" for a weekly rule', () => {
		const start = new Date('2026-05-12T17:00:00.000Z');
		const rruleString = buildRRule(start, 'weekly');

		expect(describeFrequency(rruleString)).toBe('Weekly');
	});

	it('returns "Every 2 weeks" for a biweekly rule', () => {
		const start = new Date('2026-05-12T17:00:00.000Z');
		const rruleString = buildRRule(start, 'biweekly');

		expect(describeFrequency(rruleString)).toBe('Every 2 weeks');
	});

	it('returns "Monthly" for a monthly rule', () => {
		const start = new Date('2026-05-12T17:00:00.000Z');
		const rruleString = buildRRule(start, 'monthly');

		expect(describeFrequency(rruleString)).toBe('Monthly');
	});
});
