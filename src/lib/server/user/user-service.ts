import { db } from '$lib/server/db';
import { user, session } from '$lib/server/db/schema/authentication';
import { band } from '$lib/server/db/schema/band';
import { reservation } from '$lib/server/db/schema/reservation';
import { eq, and, ne, gt, isNull, isNotNull, count } from 'drizzle-orm';
import { cancel as cancelReservation } from '$lib/server/reservation/reservation-service';
import { cancel as cancelSubscription } from '$lib/server/finance/subscription-service';

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
 * Soft-delete a user: the single offboarding entry point used by both staff
 * deactivation and user self-delete. Sets deletedAt, purges sessions, cancels
 * the user's future personal reservations, and cancels their Stripe
 * subscription. Reversible via reactivateUser (which does not restore the
 * cancelled reservations or subscription).
 */
export async function deactivateUser(userId: string) {
	const [row] = await db
		.update(user)
		.set({ deletedAt: new Date(), updatedAt: new Date() })
		.where(and(eq(user.id, userId), isNull(user.deletedAt)))
		.returning();

	if (!row) throw new UserNotFoundError();

	// Purge the user's existing sessions so a deactivated account can't keep
	// riding a live session. The per-request hook gate is the primary defense;
	// this removes the now-inert rows instead of letting them expire naturally.
	await db.delete(session).where(eq(session.userId, userId));

	// Cancel all future personal reservations booked by this user. Scoped to
	// personal bookings (bookerType 'user') — band/event/lesson reservations
	// belong to those entities, not the leaving user.
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

	// Cancel the Stripe subscription if one exists. The subscription may already
	// be gone, so failures here are non-fatal to the deactivation.
	if (row.stripeId) {
		try {
			await cancelSubscription(row.stripeId);
		} catch {
			// Subscription may not exist — that's fine.
		}
	}

	return row;
}

/**
 * Deactivate many users in one pass. Iterates `deactivateUser` per id rather
 * than a single bulk UPDATE so each user's future-reservation cancellation
 * (credit refunds / status transitions) runs through the tested single-user
 * path. The acting staff member (`skipUserId`) is never deactivated, and ids
 * that are missing / already deactivated are collected into `skipped` instead
 * of aborting the batch.
 */
export async function deactivateUsers(
	userIds: string[],
	opts: { skipUserId?: string } = {}
): Promise<{ deactivated: string[]; skipped: string[] }> {
	const deactivated: string[] = [];
	const skipped: string[] = [];

	for (const id of userIds) {
		if (id === opts.skipUserId) {
			skipped.push(id);
			continue;
		}
		try {
			await deactivateUser(id);
			deactivated.push(id);
		} catch (err) {
			if (err instanceof UserNotFoundError) {
				skipped.push(id);
				continue;
			}
			throw err;
		}
	}

	return { deactivated, skipped };
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
