import { addWeeks, addDays } from 'date-fns';
import type { RecurringFrequency } from '$lib/server/db/schema/recurring';
import { getReservationConfig } from './config';
import { getPartsInTz } from './timezone';
import { DEFAULT_TIMEZONE } from '$lib/config';

// ---------------------------------------------------------------------------
// Recurrence helpers — build, parse, and generate occurrence dates
// ---------------------------------------------------------------------------
// Replaces the `rrule` library with simple date arithmetic for the three
// recurrence patterns we support: weekly, biweekly, monthly (nth weekday).
//
// Stored format: a compact JSON string (not RFC 5545 RRULE) containing
// the frequency, interval, timezone, start components, and weekday info.
// ---------------------------------------------------------------------------

const TZ = DEFAULT_TIMEZONE;

/** Weekday names for display */
const WEEKDAY_NAMES = [
	'Sunday',
	'Monday',
	'Tuesday',
	'Wednesday',
	'Thursday',
	'Friday',
	'Saturday'
];

/** Serialized recurrence rule */
interface RecurrenceRule {
	freq: 'weekly' | 'monthly';
	interval: number;
	tz: string;
	/** Start time components in the target timezone */
	start: { year: number; month: number; day: number; hour: number; minute: number };
	/** JS weekday 0=Sun..6=Sat */
	weekday: number;
	/** For monthly: which occurrence of the weekday (1st, 2nd, 3rd, etc.) */
	nthWeek?: number;
}

/**
 * Build a recurrence rule string from a prototype date and frequency.
 *
 * For weekly/biweekly: recurs on the same day of the week.
 * For monthly: recurs on the nth weekday of the month (e.g., "3rd Tuesday").
 */
export function buildRRule(prototypeStartsAt: Date, frequency: RecurringFrequency): string {
	const parts = getPartsInTz(prototypeStartsAt, TZ);

	const rule: RecurrenceRule = {
		freq: frequency === 'monthly' ? 'monthly' : 'weekly',
		interval: frequency === 'biweekly' ? 2 : 1,
		tz: TZ,
		start: {
			year: parts.year,
			month: parts.month,
			day: parts.day,
			hour: parts.hour,
			minute: parts.minute
		},
		weekday: parts.weekday,
		nthWeek: frequency === 'monthly' ? Math.ceil(parts.day / 7) : undefined
	};

	return JSON.stringify(rule);
}

/**
 * Parse a stored recurrence rule string.
 */
export function parseRRule(rruleString: string): RecurrenceRule {
	return JSON.parse(rruleString) as RecurrenceRule;
}

/**
 * Generate occurrence dates within a window.
 *
 * Returns Date objects for each occurrence start time.
 * The caller computes endsAt by adding the prototype's duration.
 *
 * @param rruleString  Stored recurrence rule string
 * @param after        Window start (exclusive)
 * @param before       Window end (exclusive)
 * @returns            Array of occurrence start times
 */
export function getOccurrences(rruleString: string, after: Date, before: Date): Date[] {
	const rule = parseRRule(rruleString);
	const occurrences: Date[] = [];

	if (rule.freq === 'weekly') {
		// Start from the rule's initial date and step forward
		let current = buildDateFromParts(rule.start, rule.tz);

		// If starting before the window, advance to the first candidate in/near the window
		while (current.getTime() <= after.getTime()) {
			current = addWeeks(current, rule.interval);
		}

		// Generate occurrences within the window
		while (current.getTime() < before.getTime()) {
			if (current.getTime() > after.getTime()) {
				occurrences.push(current);
			}
			current = addWeeks(current, rule.interval);
		}
	} else if (rule.freq === 'monthly') {
		// Monthly: find the nth weekday of each month
		let current = buildDateFromParts(rule.start, rule.tz);
		let year = rule.start.year;
		let month = rule.start.month;

		// Advance month-by-month until we're past the window start
		while (current.getTime() <= after.getTime()) {
			month += rule.interval;
			if (month > 12) {
				year += Math.floor((month - 1) / 12);
				month = ((month - 1) % 12) + 1;
			}
			const candidate = findNthWeekdayOfMonth(
				year,
				month,
				rule.weekday,
				rule.nthWeek ?? 1,
				rule.start.hour,
				rule.start.minute,
				rule.tz
			);
			if (candidate) current = candidate;
		}

		// Generate occurrences within the window
		while (current.getTime() < before.getTime()) {
			if (current.getTime() > after.getTime()) {
				occurrences.push(current);
			}
			month += rule.interval;
			if (month > 12) {
				year += Math.floor((month - 1) / 12);
				month = ((month - 1) % 12) + 1;
			}
			const candidate = findNthWeekdayOfMonth(
				year,
				month,
				rule.weekday,
				rule.nthWeek ?? 1,
				rule.start.hour,
				rule.start.minute,
				rule.tz
			);
			if (candidate) {
				current = candidate;
			} else {
				break; // nth weekday doesn't exist in this month (e.g., 5th Tuesday)
			}
		}
	}

	return occurrences;
}

/**
 * Compute the generation window end from a reference time.
 */
export async function generationWindowEnd(from: Date = new Date()): Promise<Date> {
	const config = await getReservationConfig();
	return new Date(from.getTime() + config.maxAdvanceDaysRecurring * 24 * 60 * 60 * 1000);
}

/**
 * Extract a human-readable frequency label from a recurrence rule string.
 */
export function describeFrequency(rruleString: string): string {
	const rule = parseRRule(rruleString);

	if (rule.freq === 'monthly') return 'Monthly';
	if (rule.freq === 'weekly' && rule.interval === 2) return 'Every 2 weeks';
	if (rule.freq === 'weekly') return 'Weekly';

	return `Every ${rule.interval} weeks`;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build a Date from timezone-local components.
 */
function buildDateFromParts(
	parts: { year: number; month: number; day: number; hour: number; minute: number },
	tz: string
): Date {
	// Create approximate UTC date, then adjust for timezone offset
	const approx = new Date(
		Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0)
	);
	const offset = getUtcOffsetMinutes(approx, tz);
	const corrected = new Date(approx.getTime() + offset * 60_000);

	// Verify and re-correct for DST boundaries
	const check = getPartsInTz(corrected, tz);
	if (check.hour !== parts.hour || check.minute !== parts.minute) {
		const offset2 = getUtcOffsetMinutes(corrected, tz);
		return new Date(approx.getTime() + offset2 * 60_000);
	}

	return corrected;
}

function getUtcOffsetMinutes(date: Date, tz: string): number {
	const inTz = getPartsInTz(date, tz);
	const inUtc = getPartsInTz(date, 'UTC');

	const tzMinutes = inTz.hour * 60 + inTz.minute + inTz.day * 1440;
	const utcMinutes = inUtc.hour * 60 + inUtc.minute + inUtc.day * 1440;

	return utcMinutes - tzMinutes;
}

/**
 * Find the nth occurrence of a weekday in a given month.
 * Returns null if the nth occurrence doesn't exist (e.g., 5th Tuesday in a short month).
 */
function findNthWeekdayOfMonth(
	year: number,
	month: number,
	weekday: number,
	nth: number,
	hour: number,
	minute: number,
	tz: string
): Date | null {
	// Start at the 1st of the month
	const firstOfMonth = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
	const firstParts = getPartsInTz(firstOfMonth, tz);

	// Find the first occurrence of the target weekday
	let dayOfMonth = 1 + ((weekday - firstParts.weekday + 7) % 7);

	// Advance to the nth occurrence
	dayOfMonth += (nth - 1) * 7;

	// Check if this day exists in the month
	const daysInMonth = new Date(year, month, 0).getDate();
	if (dayOfMonth > daysInMonth) return null;

	return buildDateFromParts({ year, month, day: dayOfMonth, hour, minute }, tz);
}
