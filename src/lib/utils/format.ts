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

/** Short date with year: "Tue, May 13, 2026" */
export function formatDateYear(iso: string): string {
	return new Date(iso).toLocaleDateString('en-US', {
		timeZone: TZ,
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	});
}

/** Relative day label: "Today", "Tomorrow", "Next Wednesday", "in 3 weeks", "2 months ago" */
export function relativeDay(iso: string): string {
	const now = new Date();
	const target = new Date(iso);
	const todayStr = now.toLocaleDateString('en-CA', { timeZone: TZ });
	const targetStr = target.toLocaleDateString('en-CA', { timeZone: TZ });
	const today = new Date(todayStr);
	const targetDay = new Date(targetStr);
	const diffDays = Math.round((targetDay.getTime() - today.getTime()) / 86_400_000);

	if (diffDays === 0) return 'Today';
	if (diffDays === 1) return 'Tomorrow';
	if (diffDays === -1) return 'Yesterday';

	const dayName = target.toLocaleDateString('en-US', { timeZone: TZ, weekday: 'long' });
	if (diffDays > 1 && diffDays <= 7) return `This ${dayName}`;
	if (diffDays > 7 && diffDays <= 14) return `Next ${dayName}`;
	if (diffDays < -1 && diffDays >= -7) return `Last ${dayName}`;

	const absDays = Math.abs(diffDays);
	const weeks = Math.round(absDays / 7);
	const months = Math.round(absDays / 30);

	if (absDays < 30) {
		const label = weeks === 1 ? '1 week' : `${weeks} weeks`;
		return diffDays > 0 ? `In ${label}` : `${label} ago`;
	}
	const label = months === 1 ? '1 month' : `${months} months`;
	return diffDays > 0 ? `In ${label}` : `${label} ago`;
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

/** Short uppercase weekday: "SAT" */
export function formatDayOfWeek(iso: string): string {
	return new Date(iso)
		.toLocaleDateString('en-US', { timeZone: TZ, weekday: 'short' })
		.toUpperCase();
}

/** Day of month number: "23" */
export function formatDayNumber(iso: string): string {
	return new Date(iso).toLocaleDateString('en-US', { timeZone: TZ, day: 'numeric' });
}

/** Short uppercase month: "MAY" */
export function formatShortMonth(iso: string): string {
	return new Date(iso)
		.toLocaleDateString('en-US', { timeZone: TZ, month: 'short' })
		.toUpperCase();
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

/** "May 3, 2026" — month, day, year without weekday */
export function formatMonthDayYear(iso: string): string {
	return new Date(iso).toLocaleDateString('en-US', {
		timeZone: TZ,
		month: 'long',
		day: 'numeric',
		year: 'numeric'
	});
}

/** "Every Sunday", "Every other Tuesday", "1st Saturday of each month" */
export function formatScheduleLabel(frequencyLabel: string, startsAtIso: string): string {
	const d = new Date(startsAtIso);
	const dayName = d.toLocaleDateString('en-US', { timeZone: TZ, weekday: 'long' });

	if (frequencyLabel === 'Weekly') return `Every ${dayName}`;
	if (frequencyLabel === 'Every 2 weeks') return `Every other ${dayName}`;
	if (frequencyLabel === 'Monthly') {
		const dayOfMonth = Number(d.toLocaleDateString('en-US', { timeZone: TZ, day: 'numeric' }));
		const nth = Math.ceil(dayOfMonth / 7);
		const ordinal = nth === 1 ? '1st' : nth === 2 ? '2nd' : nth === 3 ? '3rd' : `${nth}th`;
		return `${ordinal} ${dayName} of each month`;
	}

	return frequencyLabel;
}

/** Convert HH:MM slot time to display: "14:30" → "2:30 PM" */
export function formatSlotTime(time: string): string {
	const [h, m] = time.split(':').map(Number);
	const suffix = h >= 12 ? 'PM' : 'AM';
	const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
	return `${h12}:${m.toString().padStart(2, '0')} ${suffix}`;
}
