import { db } from '$lib/server/db';
import { reservation, closure } from '$lib/server/db/schema/reservation';
import { user } from '$lib/server/db/schema/auth';
import { and, ne, eq, lt, gt } from 'drizzle-orm';
import {
	BUFFER_MINUTES,
	OPERATING_HOURS_START,
	OPERATING_HOURS_END,
	TIME_SLOT_MINUTES,
	MIN_DURATION_HOURS,
	MAX_DURATION_HOURS
} from './config';
import { buildDateInTz, formatTimeInTz } from './timezone';
import type { TimeSlot } from './types';

// ---------------------------------------------------------------------------
// ConflictService — availability checks and slot generation
// ---------------------------------------------------------------------------

/**
 * Check whether a proposed time range conflicts with any existing
 * non-cancelled reservation or closure.
 */
export async function hasConflict(
	startsAt: Date,
	endsAt: Date,
	excludeReservationId?: string
): Promise<boolean> {
	const bufferMs = BUFFER_MINUTES * 60 * 1000;
	const bufferedStart = new Date(startsAt.getTime() - bufferMs);
	const bufferedEnd = new Date(endsAt.getTime() + bufferMs);

	// Check reservations
	const reservationConflicts = await db
		.select({ id: reservation.id })
		.from(reservation)
		.where(
			and(
				ne(reservation.status, 'cancelled'),
				lt(reservation.startsAt, bufferedEnd),
				gt(reservation.endsAt, bufferedStart),
				excludeReservationId ? ne(reservation.id, excludeReservationId) : undefined
			)
		)
		.limit(1);

	if (reservationConflicts.length > 0) return true;

	// Check closures (no buffer applied)
	const closureConflicts = await db
		.select({ id: closure.id })
		.from(closure)
		.where(
			and(
				lt(closure.startsAt, endsAt),
				gt(closure.endsAt, startsAt)
			)
		)
		.limit(1);

	return closureConflicts.length > 0;
}

/**
 * Generate all 30-minute slots for a given date and mark availability.
 * Returns slots within operating hours with their booked/blocked status.
 */
export async function getAvailableSlots(date: Date): Promise<TimeSlot[]> {
	const tz = 'America/Los_Angeles';

	// Build day boundaries in local time
	const dateStr = date.toLocaleDateString('en-CA', { timeZone: tz }); // YYYY-MM-DD
	const dayStart = buildDateInTz(dateStr, OPERATING_HOURS_START, tz);
	const dayEnd = buildDateInTz(dateStr, OPERATING_HOURS_END, tz);

	// Fetch all non-cancelled reservations for this day
	const dayReservations = await db
		.select({ startsAt: reservation.startsAt, endsAt: reservation.endsAt })
		.from(reservation)
		.where(
			and(
				ne(reservation.status, 'cancelled'),
				lt(reservation.startsAt, dayEnd),
				gt(reservation.endsAt, dayStart)
			)
		);

	// Fetch closures overlapping this day
	const dayClosures = await db
		.select({ startsAt: closure.startsAt, endsAt: closure.endsAt })
		.from(closure)
		.where(
			and(
				lt(closure.startsAt, dayEnd),
				gt(closure.endsAt, dayStart)
			)
		);

	// Generate slots
	const slots: TimeSlot[] = [];
	const slotMs = TIME_SLOT_MINUTES * 60 * 1000;
	const bufferMs = BUFFER_MINUTES * 60 * 1000;

	for (let time = dayStart.getTime(); time < dayEnd.getTime(); time += slotMs) {
		const slotStart = new Date(time);
		const slotEnd = new Date(time + slotMs);

		const startTime = formatTimeInTz(slotStart, tz);
		const endTime = formatTimeInTz(slotEnd, tz);

		// Check if this slot overlaps any reservation (with buffer)
		const blockedByReservation = dayReservations.some((r) => {
			const rStart = r.startsAt.getTime() - bufferMs;
			const rEnd = r.endsAt.getTime() + bufferMs;
			return slotStart.getTime() < rEnd && slotEnd.getTime() > rStart;
		});

		// Check if this slot overlaps any closure
		const blockedByClosure = dayClosures.some((c) => {
			return slotStart.getTime() < c.endsAt.getTime() && slotEnd.getTime() > c.startsAt.getTime();
		});

		slots.push({
			startTime,
			endTime,
			available: !blockedByReservation && !blockedByClosure
		});
	}

	return slots;
}

// ---------------------------------------------------------------------------
// Validation (synchronous, no DB)
// ---------------------------------------------------------------------------

export interface ValidationResult {
	valid: boolean;
	error?: string;
}

/**
 * Validate that a proposed booking time is within operating constraints.
 * Does not check conflicts — that's a separate DB query.
 */
export function validateBooking(startsAt: Date, endsAt: Date): ValidationResult {
	const tz = 'America/Los_Angeles';

	if (endsAt <= startsAt) {
		return { valid: false, error: 'End time must be after start time' };
	}

	const durationMs = endsAt.getTime() - startsAt.getTime();
	const durationHours = durationMs / (1000 * 60 * 60);

	if (durationHours < MIN_DURATION_HOURS) {
		return { valid: false, error: `Minimum duration is ${MIN_DURATION_HOURS} hour` };
	}

	if (durationHours > MAX_DURATION_HOURS) {
		return { valid: false, error: `Maximum duration is ${MAX_DURATION_HOURS} hours` };
	}

	// Check 30-minute boundaries
	const startMinutes = startsAt.getMinutes();
	const endMinutes = endsAt.getMinutes();
	if (startMinutes % TIME_SLOT_MINUTES !== 0 || endMinutes % TIME_SLOT_MINUTES !== 0) {
		return { valid: false, error: `Times must be on ${TIME_SLOT_MINUTES}-minute boundaries` };
	}

	// Check operating hours
	const startTime = formatTimeInTz(startsAt, tz);
	const endTime = formatTimeInTz(endsAt, tz);

	if (startTime < OPERATING_HOURS_START) {
		return { valid: false, error: `Cannot start before ${OPERATING_HOURS_START}` };
	}

	if (endTime > OPERATING_HOURS_END) {
		return { valid: false, error: `Cannot end after ${OPERATING_HOURS_END}` };
	}

	return { valid: true };
}

// ---------------------------------------------------------------------------
// getConflictDetails() — detailed conflict info for staff override warnings
// ---------------------------------------------------------------------------

export interface ConflictDetail {
	type: 'reservation' | 'closure';
	startsAt: Date;
	endsAt: Date;
	label: string;
}

export async function getConflictDetails(
	startsAt: Date,
	endsAt: Date
): Promise<ConflictDetail[]> {
	const bufferMs = BUFFER_MINUTES * 60 * 1000;
	const bufferedStart = new Date(startsAt.getTime() - bufferMs);
	const bufferedEnd = new Date(endsAt.getTime() + bufferMs);

	const reservationConflicts = await db
		.select({
			startsAt: reservation.startsAt,
			endsAt: reservation.endsAt,
			userName: user.name
		})
		.from(reservation)
		.innerJoin(user, eq(reservation.createdByUserId, user.id))
		.where(
			and(
				ne(reservation.status, 'cancelled'),
				lt(reservation.startsAt, bufferedEnd),
				gt(reservation.endsAt, bufferedStart)
			)
		);

	const closureConflicts = await db
		.select({
			startsAt: closure.startsAt,
			endsAt: closure.endsAt,
			reason: closure.reason
		})
		.from(closure)
		.where(
			and(
				lt(closure.startsAt, endsAt),
				gt(closure.endsAt, startsAt)
			)
		);

	const details: ConflictDetail[] = [];

	for (const r of reservationConflicts) {
		details.push({
			type: 'reservation',
			startsAt: r.startsAt,
			endsAt: r.endsAt,
			label: r.userName
		});
	}

	for (const c of closureConflicts) {
		details.push({
			type: 'closure',
			startsAt: c.startsAt,
			endsAt: c.endsAt,
			label: c.reason
		});
	}

	return details;
}

// ---------------------------------------------------------------------------
// getValidationWarnings() — human-readable warnings without throwing
// ---------------------------------------------------------------------------

export function getValidationWarnings(startsAt: Date, endsAt: Date): string[] {
	const tz = 'America/Los_Angeles';
	const warnings: string[] = [];

	if (endsAt <= startsAt) {
		warnings.push('End time must be after start time');
		return warnings;
	}

	const durationMs = endsAt.getTime() - startsAt.getTime();
	const durationHours = durationMs / (1000 * 60 * 60);

	if (durationHours < MIN_DURATION_HOURS) {
		warnings.push(`Duration is less than the ${MIN_DURATION_HOURS}-hour minimum`);
	}

	if (durationHours > MAX_DURATION_HOURS) {
		warnings.push(`Duration exceeds the ${MAX_DURATION_HOURS}-hour maximum`);
	}

	const startMinutes = startsAt.getMinutes();
	const endMinutes = endsAt.getMinutes();
	if (startMinutes % TIME_SLOT_MINUTES !== 0 || endMinutes % TIME_SLOT_MINUTES !== 0) {
		warnings.push(`Times must be on ${TIME_SLOT_MINUTES}-minute boundaries`);
	}

	const startTime = formatTimeInTz(startsAt, tz);
	const endTime = formatTimeInTz(endsAt, tz);

	if (startTime < OPERATING_HOURS_START || endTime > OPERATING_HOURS_END) {
		warnings.push(`Outside operating hours (${OPERATING_HOURS_START} – ${OPERATING_HOURS_END})`);
	}

	return warnings;
}

