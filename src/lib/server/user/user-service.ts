import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/authentication';
import { band } from '$lib/server/db/schema/band';
import { reservation } from '$lib/server/db/schema/reservation';
import { eq, and, ne, gt, isNull, isNotNull, count } from 'drizzle-orm';
import { cancel as cancelReservation } from '$lib/server/reservation/reservation-service';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class UserNotFoundError extends Error {
	constructor() {
		super('User not found');
		this.name = 'UserNotFoundError';
	}
}

export class UserHasOwnedBandsError extends Error {
	constructor() {
		super('User still owns one or more bands; transfer or remove them before purging');
		this.name = 'UserHasOwnedBandsError';
	}
}

export class UserNotDeactivatedError extends Error {
	constructor() {
		super('User must be deactivated before it can be purged');
		this.name = 'UserNotDeactivatedError';
	}
}

export class UserHasLinkedRecordsError extends Error {
	constructor() {
		super('User has linked records that prevent permanent deletion');
		this.name = 'UserHasLinkedRecordsError';
	}
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Soft-delete a user: set deletedAt and cancel all of their future personal
 * reservations. Mirrors band deactivation. Reversible via reactivateUser.
 */
export async function deactivateUser(userId: string) {
	const [row] = await db
		.update(user)
		.set({ deletedAt: new Date(), updatedAt: new Date() })
		.where(and(eq(user.id, userId), isNull(user.deletedAt)))
		.returning();

	if (!row) throw new UserNotFoundError();

	// Cancel all future personal reservations booked by this user.
	const futureReservations = await db
		.select({ id: reservation.id })
		.from(reservation)
		.where(
			and(
				eq(reservation.bookerType, 'user'),
				eq(reservation.bookerId, userId),
				gt(reservation.startsAt, new Date()),
				ne(reservation.status, 'cancelled')
			)
		);

	for (const r of futureReservations) {
		await cancelReservation(r.id, userId, 'Account deactivated', { staffOverride: true });
	}

	return row;
}

/** Restore a soft-deleted user. */
export async function reactivateUser(userId: string) {
	const [row] = await db
		.update(user)
		.set({ deletedAt: null, updatedAt: new Date() })
		.where(and(eq(user.id, userId), isNotNull(user.deletedAt)))
		.returning();

	if (!row) throw new UserNotFoundError();
	return row;
}

/**
 * Permanently delete a user row. Only permitted once the user is already
 * soft-deleted. Refuses if the user owns any band (band.ownerId is
 * onDelete: 'restrict'). Other dependent rows are handled by their FK
 * onDelete rules; remaining restrict-style FKs surface as
 * UserHasLinkedRecordsError rather than a raw SQL error.
 */
export async function purgeUser(userId: string) {
	const [target] = await db
		.select({ id: user.id, deletedAt: user.deletedAt })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);

	if (!target) throw new UserNotFoundError();
	if (!target.deletedAt) throw new UserNotDeactivatedError();

	const [{ value: ownedBands }] = await db
		.select({ value: count() })
		.from(band)
		.where(eq(band.ownerId, userId));

	if (ownedBands > 0) throw new UserHasOwnedBandsError();

	try {
		await db.delete(user).where(eq(user.id, userId));
	} catch (err) {
		// Foreign-key constraint from another restrict/no-action reference.
		if (err instanceof Error && /FOREIGN KEY|constraint/i.test(err.message)) {
			throw new UserHasLinkedRecordsError();
		}
		throw err;
	}
}
