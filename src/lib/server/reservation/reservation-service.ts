import { db, getRowCount } from '$lib/server/db';
import { reservation } from '$lib/server/db/schema/reservation';
import { eq, and, or, lt, gt, isNotNull, inArray, notInArray } from 'drizzle-orm';
import { validateBooking } from './conflict-service';
import { refund } from '$lib/server/finance/payment-service';
import { reverseReservationCredits } from './reservation-credit-service';
import { domainEvents } from '$lib/server/events/event-bus';
import { user } from '$lib/server/db/schema/authentication';
import { formatDateInTz, formatTimeInTz } from './timezone';
import { DEFAULT_TIMEZONE } from '$lib/config';
import type { BookerType, ReservationStatus } from '$lib/server/db/schema/reservation';

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

/**
 * Thrown when a reservation can't transition to the requested state — e.g.
 * cancelling an already-cancelled reservation, or a concurrent status change.
 * These are expected conflicts (stale UI, double-click), not server faults.
 */
export class ReservationStateError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ReservationStateError';
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
	const validation = await validateBooking(startsAt, endsAt);
	if (!validation.valid) {
		throw new ReservationValidationError(validation.error!);
	}

	// Conflict check then insert (D1 doesn't support interactive transactions)
	const conflicts = await db
		.select({ id: reservation.id })
		.from(reservation)
		.where(
			and(
				notInArray(reservation.status, ['cancelled', 'waitlisted']),
				lt(reservation.startsAt, endsAt),
				gt(reservation.endsAt, startsAt)
			)
		);

	if (conflicts.length > 0) {
		throw new ReservationConflictError();
	}

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
// createWaitlisted() — create with waitlisted status (skip conflict check)
// ---------------------------------------------------------------------------

export async function createWaitlisted(params: CreateReservationParams): Promise<ReservationRow> {
	const { userId, bookerType, bookerId, startsAt, endsAt, notes } = params;

	const validation = await validateBooking(startsAt, endsAt);
	if (!validation.valid) {
		throw new ReservationValidationError(validation.error!);
	}

	const [row] = await db
		.insert(reservation)
		.values({
			bookerType,
			bookerId,
			createdByUserId: userId,
			status: 'waitlisted',
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

	if (startsAt >= endsAt)
		throw new ReservationValidationError('Reservation must end after it starts');

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
		throw new ReservationStateError(`Cannot cancel a reservation with status "${status}"`);
	}

	// Atomic conditional update — only cancels if status hasn't changed since read
	const cancellable: ReservationStatus[] = ['scheduled', 'confirmed', 'waitlisted'];
	const result = await db
		.update(reservation)
		.set({
			status: 'cancelled',
			cancellationReason: reason ?? null,
			updatedAt: new Date()
		})
		.where(and(eq(reservation.id, reservationId), inArray(reservation.status, cancellable)));

	if (getRowCount(result) === 0) {
		throw new ReservationStateError('Reservation status changed concurrently');
	}

	// If a payment was recorded, refund it (Stripe-side). Credits committed to the
	// reservation live in the ledger (not the payment record breakdown), so reverse
	// them separately — this also covers cash-owed confirms that have credits
	// committed but no payment record yet. Both paths are idempotent / no-ops when
	// nothing applies.
	if (row.stripePaymentRecordId) {
		await refund({
			userId,
			stripePaymentRecordId: row.stripePaymentRecordId
		});
		await db
			.update(reservation)
			.set({ refundedAt: new Date() })
			.where(eq(reservation.id, reservationId));
	}
	await reverseReservationCredits(row.createdByUserId, reservationId);

	// Emit cancellation event (enables waitlist promotion)
	const TZ = DEFAULT_TIMEZONE;
	const [cancelledUser] = await db
		.select({ name: user.name, email: user.email })
		.from(user)
		.where(eq(user.id, row.createdByUserId))
		.limit(1);

	await domainEvents.emit('reservation.cancelled', {
		reservationId,
		userId: row.createdByUserId,
		userName: cancelledUser?.name ?? '',
		userEmail: cancelledUser?.email ?? '',
		date: formatDateInTz(row.startsAt, TZ),
		startTime: formatTimeInTz(row.startsAt, TZ),
		endTime: formatTimeInTz(row.endsAt, TZ),
		cancelledBy: options?.staffOverride ? 'staff' : 'member'
	});
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
 * Staff records cash payment for a scheduled or confirmed (cash-owed) reservation
 * and completes it in one action. Returns the Stripe payment record ID for
 * bookkeeping.
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
			paidAt: new Date(),
			cashDueCents: 0,
			updatedAt: new Date()
		})
		.where(
			and(
				eq(reservation.id, reservationId),
				inArray(reservation.status, ['scheduled', 'confirmed'])
			)
		);

	if (getRowCount(result) === 0) {
		const [row] = await db
			.select({ status: reservation.status })
			.from(reservation)
			.where(eq(reservation.id, reservationId))
			.limit(1);

		if (!row) throw new Error('Reservation not found');
		throw new Error(`Expected status "scheduled" or "confirmed", got "${row.status}"`);
	}
}

// ---------------------------------------------------------------------------
// autoCompleteExpired() — bulk-complete paid reservations past their end time
// ---------------------------------------------------------------------------

export async function autoCompleteExpired(): Promise<number> {
	const now = new Date();
	// Auto-complete confirmed reservations past their end time that owe no cash:
	// paid (has a payment record) or comped/credit-settled (cashDueCents = 0).
	// Cash-owed reservations (cashDueCents > 0) are left for staff to collect.
	const result = await db
		.update(reservation)
		.set({ status: 'completed', updatedAt: now })
		.where(
			and(
				eq(reservation.status, 'confirmed'),
				lt(reservation.endsAt, now),
				or(isNotNull(reservation.stripePaymentRecordId), eq(reservation.cashDueCents, 0))
			)
		);
	return getRowCount(result);
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
		.where(and(eq(reservation.id, reservationId), inArray(reservation.status, expectedStatuses)));

	if (getRowCount(result) === 0) {
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
