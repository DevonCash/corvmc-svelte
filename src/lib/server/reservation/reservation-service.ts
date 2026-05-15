import { db } from '$lib/server/db';
import { reservation } from '$lib/server/db/schema/reservation';
import { eq, and, lt, ne, gt, isNotNull, inArray, sql } from 'drizzle-orm';
import { hasConflict, validateBooking } from './conflict-service';
import { refund } from '$lib/server/finance/payment-service';
import type { BookerType, ReservationStatus } from './types';

// ---------------------------------------------------------------------------
// ReservationService — create and cancel reservations
// ---------------------------------------------------------------------------

export class ReservationConflictError extends Error {
	constructor() {
		super('Time slot is not available');
		this.name = 'ReservationConflictError';
	}
}

export class ReservationValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ReservationValidationError';
	}
}

// ---------------------------------------------------------------------------
// create()
// ---------------------------------------------------------------------------

export interface CreateReservationParams {
	userId: string;
	bookerType: BookerType;
	bookerId: string;
	startsAt: Date;
	endsAt: Date;
	notes?: string;
}

export interface ReservationRow {
	id: string;
	bookerType: string;
	bookerId: string;
	createdByUserId: string;
	status: string;
	startsAt: Date;
	endsAt: Date;
	notes: string | null;
	cancellationReason: string | null;
	stripePaymentRecordId: string | null;
	lockAccessId: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export async function create(params: CreateReservationParams): Promise<ReservationRow> {
	const { userId, bookerType, bookerId, startsAt, endsAt, notes } = params;

	// Validate time constraints
	const validation = validateBooking(startsAt, endsAt);
	if (!validation.valid) {
		throw new ReservationValidationError(validation.error!);
	}

	// Conflict check + insert in a serializable transaction to prevent races
	return await db.transaction(async (tx) => {
		// Lock overlapping rows to prevent concurrent inserts
		const conflicts = await tx
			.select({ id: reservation.id })
			.from(reservation)
			.where(
				and(
					ne(reservation.status, 'cancelled'),
					lt(reservation.startsAt, endsAt),
					gt(reservation.endsAt, startsAt)
				)
			)
			;

		if (conflicts.length > 0) {
			throw new ReservationConflictError();
		}

		const [row] = await tx
			.insert(reservation)
			.values({
				bookerType,
				bookerId,
				createdByUserId: userId,
				status: 'scheduled',
				startsAt,
				endsAt,
				notes: notes ?? null
			})
			.returning();

		return row;
	});
}

// ---------------------------------------------------------------------------
// staffCreate() — skip validation and conflict checks
// ---------------------------------------------------------------------------

export interface StaffCreateReservationParams extends CreateReservationParams {
	status?: ReservationStatus;
}

export async function staffCreate(params: StaffCreateReservationParams): Promise<ReservationRow> {
	const { userId, bookerType, bookerId, startsAt, endsAt, notes, status = 'confirmed' } = params;

	const [row] = await db
		.insert(reservation)
		.values({
			bookerType,
			bookerId,
			createdByUserId: userId,
			status,
			startsAt,
			endsAt,
			notes: notes ?? null
		})
		.returning();

	return row;
}

// ---------------------------------------------------------------------------
// confirm() — staff confirmation without payment
// ---------------------------------------------------------------------------

export async function confirm(reservationId: string): Promise<void> {
	await updateStatus(reservationId, ['scheduled'], 'confirmed');
}

// ---------------------------------------------------------------------------
// cancel()
// ---------------------------------------------------------------------------

export async function cancel(
	reservationId: string,
	userId: string,
	reason?: string,
	options?: { staffOverride?: boolean }
): Promise<void> {
	// Read current state to check authorization and determine refund eligibility
	const [row] = await db
		.select()
		.from(reservation)
		.where(eq(reservation.id, reservationId))
		.limit(1);

	if (!row) {
		throw new Error('Reservation not found');
	}

	if (!options?.staffOverride && row.createdByUserId !== userId) {
		throw new Error('Not authorized to cancel this reservation');
	}

	const status = row.status as ReservationStatus;

	if (status === 'cancelled' || status === 'completed' || status === 'no_show') {
		throw new Error(`Cannot cancel a reservation with status "${status}"`);
	}

	// Atomic conditional update — only cancels if status hasn't changed since read
	const cancellable: ReservationStatus[] = ['scheduled', 'confirmed'];
	const result = await db
		.update(reservation)
		.set({
			status: 'cancelled',
			cancellationReason: reason ?? null,
			updatedAt: new Date()
		})
		.where(
			and(
				eq(reservation.id, reservationId),
				inArray(reservation.status, cancellable)
			)
		);

	const rowCount = (result as unknown as { rowCount: number }).rowCount ?? 0;
	if (rowCount === 0) {
		throw new Error('Reservation status changed concurrently');
	}

	// If it was confirmed (paid), trigger refund
	if (status === 'confirmed' && row.stripePaymentRecordId) {
		await refund({
			userId,
			stripePaymentRecordId: row.stripePaymentRecordId
		});
	}
}

// ---------------------------------------------------------------------------
// Staff resolution actions
// ---------------------------------------------------------------------------

export async function markComplete(reservationId: string): Promise<void> {
	await updateStatus(reservationId, ['confirmed'], 'completed');
}

export async function markNoShow(reservationId: string): Promise<void> {
	await updateStatus(reservationId, ['confirmed', 'scheduled'], 'no_show');
}

/**
 * Staff records cash payment for a scheduled reservation.
 * Transitions: scheduled → confirmed → completed in one action.
 * Returns the Stripe payment record ID for bookkeeping.
 */
export async function recordCashAndComplete(
	reservationId: string,
	stripePaymentRecordId: string
): Promise<void> {
	const result = await db
		.update(reservation)
		.set({
			status: 'completed',
			stripePaymentRecordId,
			updatedAt: new Date()
		})
		.where(
			and(
				eq(reservation.id, reservationId),
				eq(reservation.status, 'scheduled')
			)
		);

	const rowCount = (result as unknown as { rowCount: number }).rowCount ?? 0;
	if (rowCount === 0) {
		const [row] = await db
			.select({ status: reservation.status })
			.from(reservation)
			.where(eq(reservation.id, reservationId))
			.limit(1);

		if (!row) throw new Error('Reservation not found');
		throw new Error(`Expected status "scheduled", got "${row.status}"`);
	}
}

// ---------------------------------------------------------------------------
// autoCompleteExpired() — bulk-complete paid reservations past their end time
// ---------------------------------------------------------------------------

export async function autoCompleteExpired(): Promise<number> {
	const now = new Date();
	const result = await db
		.update(reservation)
		.set({ status: 'completed', updatedAt: now })
		.where(
			and(
				eq(reservation.status, 'confirmed'),
				isNotNull(reservation.stripePaymentRecordId),
				lt(reservation.endsAt, now)
			)
		);
	return (result as unknown as { rowCount: number }).rowCount ?? 0;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function updateStatus(
	reservationId: string,
	expectedStatuses: ReservationStatus[],
	newStatus: ReservationStatus
): Promise<void> {
	// Atomic conditional update — avoids the select-then-update race condition
	const result = await db
		.update(reservation)
		.set({ status: newStatus, updatedAt: new Date() })
		.where(
			and(
				eq(reservation.id, reservationId),
				inArray(reservation.status, expectedStatuses)
			)
		);

	const rowCount = (result as unknown as { rowCount: number }).rowCount ?? 0;

	if (rowCount === 0) {
		// Determine whether it's "not found" or "wrong status"
		const [row] = await db
			.select({ status: reservation.status })
			.from(reservation)
			.where(eq(reservation.id, reservationId))
			.limit(1);

		if (!row) throw new Error('Reservation not found');
		throw new Error(`Cannot transition from "${row.status}" to "${newStatus}"`);
	}
}
