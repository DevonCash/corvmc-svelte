import { DateTime } from 'luxon';

// ---------------------------------------------------------------------------
// Timezone utilities — construct and format Dates in a specific IANA timezone
// using luxon for correct DST handling.
// ---------------------------------------------------------------------------

/**
 * Build a Date representing `dateStr` at `timeStr` in the given timezone.
 *
 * @param dateStr  "YYYY-MM-DD"
 * @param timeStr  "HH:MM"
 * @param tz       IANA timezone, e.g. "America/Los_Angeles"
 * @returns        A Date whose `.getTime()` is the correct UTC instant
 */
export function buildDateInTz(dateStr: string, timeStr: string, tz: string): Date {
	const dt = DateTime.fromISO(`${dateStr}T${timeStr}:00`, { zone: tz });
	if (!dt.isValid) {
		throw new Error(`Invalid date/time: ${dateStr} ${timeStr} in ${tz}`);
	}
	return dt.toJSDate();
}

/**
 * Format a Date as "HH:mm" in the given timezone.
 */
export function formatTimeInTz(date: Date, tz: string): string {
	return DateTime.fromJSDate(date, { zone: tz }).toFormat('HH:mm');
}

/**
 * Format a Date as "YYYY-MM-DD" in the given timezone.
 */
export function formatDateInTz(date: Date, tz: string): string {
	return DateTime.fromJSDate(date, { zone: tz }).toFormat('yyyy-MM-dd');
}
