/**
 * Shared date, time, and currency formatting utilities.
 * All date/time functions use the America/Los_Angeles timezone.
 */

const TZ = 'America/Los_Angeles';

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

/** Short date: "Tue, May 13" */
export function formatDate(iso: string): string {
	return new Date(iso).toLocaleDateString('en-US', {
		timeZone: TZ,
		weekday: 'short',
		month: 'short',
		day: 'numeric'
	});
}

/** Long date: "Tuesday, May 13, 2026" */
export function fullDate(iso: string): string {
	return new Date(iso).toLocaleDateString('en-US', {
		timeZone: TZ,
		weekday: 'long',
		month: 'long',
		day: 'numeric',
		year: 'numeric'
	});
}

/** Date + time combined: "Tue, May 13, 2:30 PM" */
export function formatDateTime(iso: string): string {
	return new Date(iso).toLocaleString('en-US', {
		timeZone: TZ,
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	});
}

// ---------------------------------------------------------------------------
// Time formatting
// ---------------------------------------------------------------------------

/** Time only: "2:30 PM" */
export function formatTime(iso: string): string {
	return new Date(iso).toLocaleTimeString('en-US', {
		timeZone: TZ,
		hour: 'numeric',
		minute: '2-digit'
	});
}

/** Time range: "2:30 PM – 5:00 PM" */
export function formatTimeRange(startsAt: string, endsAt: string): string {
	return `${formatTime(startsAt)} – ${formatTime(endsAt)}`;
}

/** ISO → local date string for date inputs: "2026-05-13" */
export function toLocalDate(iso: string): string {
	return new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
}

/** ISO → local 24h time for time inputs: "14:30" */
export function toLocalTime(iso: string): string {
	return new Date(iso).toLocaleTimeString('en-GB', {
		timeZone: TZ,
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	});
}

// ---------------------------------------------------------------------------
// Duration
// ---------------------------------------------------------------------------

/** Duration between two ISO timestamps in decimal hours. */
export function durationHours(startsAt: string, endsAt: string): number {
	return (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / (1000 * 60 * 60);
}

/** Human-readable duration: "1 hour" or "2.5 hours" */
export function formatDuration(startsAt: string, endsAt: string): string {
	const h = durationHours(startsAt, endsAt);
	return `${h} hour${h === 1 ? '' : 's'}`;
}

// ---------------------------------------------------------------------------
// Currency
// ---------------------------------------------------------------------------

/** Format cents as dollars: 1500 → "$15.00" */
export function formatCents(cents: number): string {
	return `$${(cents / 100).toFixed(2)}`;
}

/** Format cents as dollars without symbol: 1500 → "15.00" */
export function formatDollars(cents: number): string {
	return (cents / 100).toFixed(2);
}

/** Calculate amount from duration and rate, formatted: "$30.00" */
export function formatDurationAmount(startsAt: string, endsAt: string, hourlyRateCents: number): string {
	const hours = durationHours(startsAt, endsAt);
	const cents = Math.round(hours * hourlyRateCents);
	return formatCents(cents);
}

/** "2 hrs · $24.50" */
export function formatDurationAndAmount(startsAt: string, endsAt: string, hourlyRateCents: number): string {
	const h = durationHours(startsAt, endsAt);
	const label = h === 1 ? '1 hr' : `${h} hrs`;
	return `${label} · ${formatDurationAmount(startsAt, endsAt, hourlyRateCents)}`;
}

/** Convert HH:MM slot time to display: "14:30" → "2:30 PM" */
export function formatSlotTime(time: string): string {
	const [h, m] = time.split(':').map(Number);
	const suffix = h >= 12 ? 'PM' : 'AM';
	const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
	return `${h12}:${m.toString().padStart(2, '0')} ${suffix}`;
}
