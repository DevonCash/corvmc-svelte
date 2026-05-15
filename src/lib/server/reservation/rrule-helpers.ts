import { RRule, Frequency } from 'rrule';
import { DateTime } from 'luxon';
import type { RecurringFrequency } from './config';
import { MAX_ADVANCE_DAYS_RECURRING } from './config';

// ---------------------------------------------------------------------------
// RRULE helpers — build, parse, and generate occurrence dates
// ---------------------------------------------------------------------------

const TZ = 'America/Los_Angeles';

/**
 * Map our frequency names to RRULE Frequency + interval.
 */
function frequencyParams(freq: RecurringFrequency): { freq: Frequency; interval: number } {
	switch (freq) {
		case 'weekly':
			return { freq: Frequency.WEEKLY, interval: 1 };
		case 'biweekly':
			return { freq: Frequency.WEEKLY, interval: 2 };
		case 'monthly':
			return { freq: Frequency.MONTHLY, interval: 1 };
	}
}

/**
 * Map JS weekday (0=Sun) to RRULE weekday constant.
 * `rrule` uses RRule.MO (0) through RRule.SU (6).
 */
const RRULE_WEEKDAYS = [RRule.SU, RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA];

/**
 * Build an RRULE string from a prototype date and recurrence frequency.
 *
 * For weekly/biweekly: BYDAY is derived from the prototype's day-of-week.
 * For monthly: BYDAY uses nth-weekday-of-month (e.g., "3rd Tuesday").
 *
 * @param prototypeStartsAt  The prototype reservation's start time (Date)
 * @param frequency           'weekly' | 'biweekly' | 'monthly'
 * @returns                   RFC 5545 RRULE string (includes DTSTART)
 */
export function buildRRule(prototypeStartsAt: Date, frequency: RecurringFrequency): string {
	const dt = DateTime.fromJSDate(prototypeStartsAt, { zone: TZ });

	const { freq, interval } = frequencyParams(frequency);
	const weekdayConst = RRULE_WEEKDAYS[dt.weekday % 7]; // luxon: 1=Mon..7=Sun → %7 maps Sun(7)→0

	const options: Partial<ConstructorParameters<typeof RRule>[0]> = {
		freq,
		interval,
		// dtstart in rrule is treated as UTC-like; we set tzid for proper TZ handling
		dtstart: new Date(Date.UTC(dt.year, dt.month - 1, dt.day, dt.hour, dt.minute, 0)),
		tzid: TZ
	};

	if (frequency === 'monthly') {
		// nth weekday of month: e.g., 3rd Tuesday
		const nthWeek = Math.ceil(dt.day / 7);
		options.byweekday = [weekdayConst.nth(nthWeek)];
	} else {
		options.byweekday = [weekdayConst];
	}

	const rule = new RRule(options as ConstructorParameters<typeof RRule>[0]);
	return rule.toString();
}

/**
 * Parse a stored RRULE string back into an RRule instance.
 */
export function parseRRule(rruleString: string): RRule {
	return RRule.fromString(rruleString);
}

/**
 * Generate occurrence dates within the generation window.
 *
 * Returns UTC Date objects for each occurrence (the RRULE's DTSTART time
 * adjusted by the TZID). Each date represents the start time of that
 * occurrence — the caller computes endsAt by adding the prototype's duration.
 *
 * @param rruleString  Stored RRULE string
 * @param after        Window start (exclusive). Typically `new Date()`.
 * @param before       Window end (exclusive). Typically now + MAX_ADVANCE_DAYS_RECURRING.
 * @returns            Array of occurrence start times as Date objects
 */
export function getOccurrences(
	rruleString: string,
	after: Date,
	before: Date
): Date[] {
	const rule = parseRRule(rruleString);
	return rule.between(after, before, false);
}

/**
 * Compute the generation window end from a reference time.
 * Returns a Date that is MAX_ADVANCE_DAYS_RECURRING days in the future.
 */
export function generationWindowEnd(from: Date = new Date()): Date {
	return new Date(from.getTime() + MAX_ADVANCE_DAYS_RECURRING * 24 * 60 * 60 * 1000);
}

/**
 * Extract a human-readable frequency label from an RRULE string.
 */
export function describeFrequency(rruleString: string): string {
	const rule = parseRRule(rruleString);
	const opts = rule.origOptions;

	if (opts.freq === Frequency.MONTHLY) return 'Monthly';
	if (opts.freq === Frequency.WEEKLY && (opts.interval ?? 1) === 2) return 'Every 2 weeks';
	if (opts.freq === Frequency.WEEKLY) return 'Weekly';

	return rule.toText();
}
