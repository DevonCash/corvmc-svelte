/**
 * Shared date, time, and currency formatting utilities.
 */

import { format, differenceInCalendarDays, getDate } from 'date-fns';

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

/** Short date: "Tue, May 13" */
export function formatDate(d: Date): string {
	return format(d, 'EEE, MMM d');
}

/** Short date with year: "Tue, May 13, 2026" */
export function formatDateYear(d: Date): string {
	return format(d, 'EEE, MMM d, yyyy');
}

/** Relative day label: "Today", "Tomorrow", "Next Wednesday", "in 3 weeks", "2 months ago" */
export function relativeDay(d: Date): string {
	const now = new Date();
	now.setHours(0, 0, 0, 0);
	const target = new Date(d);
	target.setHours(0, 0, 0, 0);
	const diffDays = differenceInCalendarDays(target, now);

	if (diffDays === 0) return 'Today';
	if (diffDays === 1) return 'Tomorrow';
	if (diffDays === -1) return 'Yesterday';

	const dayName = format(d, 'EEEE');
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
export function fullDate(d: Date): string {
	return format(d, 'EEEE, MMMM d, yyyy');
}

/** Short uppercase weekday: "SAT" */
export function formatDayOfWeek(d: Date): string {
	return format(d, 'EEE').toUpperCase();
}

/** Day of month number: "23" */
export function formatDayNumber(d: Date): string {
	return format(d, 'd');
}

/** Short uppercase month: "MAY" */
export function formatShortMonth(d: Date): string {
	return format(d, 'MMM').toUpperCase();
}

/** Date + time combined: "Tue, May 13, 2:30 PM" */
export function formatDateTime(d: Date): string {
	return format(d, 'EEE, MMM d, h:mm a');
}

// ---------------------------------------------------------------------------
// Time formatting
// ---------------------------------------------------------------------------

/** Time only: "2:30 PM" */
export function formatTime(d: Date): string {
	return format(d, 'h:mm a');
}

/** Time range: "2:30 PM – 5:00 PM" */
export function formatTimeRange(startsAt: Date, endsAt: Date): string {
	return `${formatTime(startsAt)} – ${formatTime(endsAt)}`;
}

/** Date → local date string for date inputs: "2026-05-13" */
export function toLocalDate(d: Date): string {
	return format(d, 'yyyy-MM-dd');
}

/** Date → local 24h time for time inputs: "14:30" */
export function toLocalTime(d: Date): string {
	return format(d, 'HH:mm');
}

// ---------------------------------------------------------------------------
// Duration
// ---------------------------------------------------------------------------

/** Duration between two timestamps in decimal hours. */
export function durationHours(startsAt: Date, endsAt: Date): number {
	return (endsAt.getTime() - startsAt.getTime()) / (1000 * 60 * 60);
}

/** Human-readable duration: "1 hour" or "2.5 hours" */
export function formatDuration(startsAt: Date, endsAt: Date): string {
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
export function formatDurationAmount(
	startsAt: Date,
	endsAt: Date,
	hourlyRateCents: number
): string {
	const hours = durationHours(startsAt, endsAt);
	const cents = Math.round(hours * hourlyRateCents);
	return formatCents(cents);
}

/** "2 hrs · $24.50" */
export function formatDurationAndAmount(
	startsAt: Date,
	endsAt: Date,
	hourlyRateCents: number
): string {
	const h = durationHours(startsAt, endsAt);
	const label = h === 1 ? '1 hr' : `${h} hrs`;
	return `${label} · ${formatDurationAmount(startsAt, endsAt, hourlyRateCents)}`;
}

/** "May 3, 2026" — month, day, year without weekday */
export function formatMonthDayYear(d: Date): string {
	return format(d, 'MMMM d, yyyy');
}

/** "Every Sunday", "Every other Tuesday", "1st Saturday of each month" */
export function formatScheduleLabel(frequencyLabel: string, startsAt: Date): string {
	const dayName = format(startsAt, 'EEEE');

	if (frequencyLabel === 'Weekly') return `Every ${dayName}`;
	if (frequencyLabel === 'Every 2 weeks') return `Every other ${dayName}`;
	if (frequencyLabel === 'Monthly') {
		const dayOfMonth = getDate(startsAt);
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
