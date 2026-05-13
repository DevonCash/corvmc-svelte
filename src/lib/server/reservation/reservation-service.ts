import { db } from '$lib/server/db';
import { reservation } from '$lib/server/db/schema/reservation';
import { eq, and, lt, isNotNull } from 'drizzle-orm';
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

	// Check for conflicts
	const conflict = await hasConflict(startsAt, endsAt);
	if (conflict) {
		throw new ReservationConflictError();
	}

	// Insert
	const [row] = await db
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

	// Update status
	await db
		.update(reservation)
		.set({
			status: 'cancelled',
			cancellationReason: reason ?? null,
			updatedAt: new Date()
		})
		.where(eq(reservation.id, reservationId));

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
	const [row] = await db
		.select()
		.from(reservation)
		.where(eq(reservation.id, reservationId))
		.limit(1);

	if (!row) throw new Error('Reservation not found');
	if (row.status !== 'scheduled') {
		throw new Error(`Expected status "scheduled", got "${row.status}"`);
	}

	await db
		.update(reservation)
		.set({
			status: 'completed',
			stripePaymentRecordId,
			updatedAt: new Date()
		})
		.where(eq(reservation.id, reservationId));
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
	const [row] = await db
		.select({ status: reservation.status })
		.from(reservation)
		.where(eq(reservation.id, reservationId))
		.limit(1);

	if (!row) throw new Error('Reservation not found');
	if (!expectedStatuses.includes(row.status as ReservationStatus)) {
		throw new Error(
			`Cannot transition from "${row.status}" to "${newStatus}"`
		);
	}

	await db
		.update(reservation)
		.set({ status: newStatus, updatedAt: new Date() })
		.where(eq(reservation.id, reservationId));
}
