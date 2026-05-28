// ---------------------------------------------------------------------------
// Timezone utilities — construct and format Dates in a specific IANA timezone
// using the built-in Intl API for correct DST handling.
// ---------------------------------------------------------------------------

/**
 * Get date/time components for a Date in a specific timezone.
 */
export function getPartsInTz(
	date: Date,
	tz: string
): { year: number; month: number; day: number; hour: number; minute: number; weekday: number } {
	const fmt = new Intl.DateTimeFormat('en-US', {
		timeZone: tz,
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
		weekday: 'short',
		hour12: false
	});
	const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));

	// Intl hour12:false gives "24" for midnight in some engines — normalize to 0
	const hour = parseInt(parts.hour) % 24;

	// Map weekday abbreviation to JS weekday (0=Sun)
	const weekdayMap: Record<string, number> = {
		Sun: 0,
		Mon: 1,
		Tue: 2,
		Wed: 3,
		Thu: 4,
		Fri: 5,
		Sat: 6
	};

	return {
		year: parseInt(parts.year),
		month: parseInt(parts.month),
		day: parseInt(parts.day),
		hour,
		minute: parseInt(parts.minute),
		weekday: weekdayMap[parts.weekday] ?? 0
	};
}

/**
 * Build a Date representing `dateStr` at `timeStr` in the given timezone.
 *
 * @param dateStr  "YYYY-MM-DD"
 * @param timeStr  "HH:MM"
 * @param tz       IANA timezone, e.g. "America/Los_Angeles"
 * @returns        A Date whose `.getTime()` is the correct UTC instant
 */
export function buildDateInTz(dateStr: string, timeStr: string, tz: string): Date {
	const [year, month, day] = dateStr.split('-').map(Number);
	const [hour, minute] = timeStr.split(':').map(Number);

	// Create an approximate Date in UTC, then adjust for the timezone offset.
	// Use a binary-search-style correction since DST offset depends on the instant.
	const approx = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));

	// Get the offset at this approximate time
	const offset = getUtcOffsetMinutes(approx, tz);
	const corrected = new Date(approx.getTime() + offset * 60_000);

	// Verify by re-reading the corrected time in the target timezone
	const check = getPartsInTz(corrected, tz);
	if (check.hour !== hour || check.minute !== minute || check.day !== day) {
		// DST boundary — apply the offset at the corrected time
		const offset2 = getUtcOffsetMinutes(corrected, tz);
		return new Date(approx.getTime() + offset2 * 60_000);
	}

	return corrected;
}

/**
 * Get the UTC offset in minutes for a timezone at a given instant.
 * Positive = behind UTC, negative = ahead (matching getTimezoneOffset convention).
 */
function getUtcOffsetMinutes(date: Date, tz: string): number {
	// Format the date in the target timezone and in UTC, then diff
	const inTz = getPartsInTz(date, tz);
	const inUtc = getPartsInTz(date, 'UTC');

	const tzMinutes = inTz.hour * 60 + inTz.minute + inTz.day * 1440;
	const utcMinutes = inUtc.hour * 60 + inUtc.minute + inUtc.day * 1440;

	return utcMinutes - tzMinutes;
}

/**
 * Format a Date as "HH:mm" in the given timezone.
 */
export function formatTimeInTz(date: Date, tz: string): string {
	return date.toLocaleString('en-GB', {
		timeZone: tz,
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	});
}

/**
 * Format a Date as "YYYY-MM-DD" in the given timezone.
 */
export function formatDateInTz(date: Date, tz: string): string {
	const p = getPartsInTz(date, tz);
	return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/**
 * Format a Date as a full human-readable date string in the given timezone.
 * e.g. "January 15, 2026"
 */
export function formatDateFull(date: Date, tz: string): string {
	return date.toLocaleString('en-US', {
		timeZone: tz,
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});
}

/**
 * Format a Date as a simple time string in the given timezone.
 * e.g. "3:30 PM"
 */
export function formatTimeSimple(date: Date, tz: string): string {
	return date.toLocaleString('en-US', {
		timeZone: tz,
		hour: 'numeric',
		minute: '2-digit',
		hour12: true
	});
}
