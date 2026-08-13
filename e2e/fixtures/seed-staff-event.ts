/**
 * Clear the events the staff event-creation e2e leaves behind.
 *
 * Unlike the other fixtures this one seeds nothing — the test creates its event
 * through the real UI. What it needs is the *absence* of last run's event: that
 * event holds a confirmed practice-space reservation for a fixed window, so a
 * second run booking the same window is rejected as a genuine conflict and the
 * suite fails on a stale row rather than on the code under test.
 *
 * Idempotent: deletes its own rows on every run.
 *
 * Mirrors the D1 access pattern in seed-staff-user.ts.
 */
import { and, eq, inArray, like } from 'drizzle-orm';
import { withPlatformDb } from './platform-db';
import { event } from '../../src/lib/server/db/schema/event';
import { reservation } from '../../src/lib/server/db/schema/reservation';

/** Titles the test creates are prefixed with this so they can be found again. */
export const SEED_EVENT_TITLE_PREFIX = 'E2E Reserved Show';

/** The window the test holds. Far enough out that no other fixture collides. */
export const SEED_EVENT_DATE = '2030-06-15';
export const SEED_EVENT_START = '19:00';
export const SEED_EVENT_END = '22:00';

export async function seedStaffEvent() {
	await withPlatformDb(async (db) => {
		const stale = await db
			.select({ id: event.id, reservationId: event.reservationId })
			.from(event)
			.where(like(event.title, `${SEED_EVENT_TITLE_PREFIX}%`));

		if (stale.length === 0) return;

		// Events first: `event.reservation_id` is a foreign key into reservation,
		// so the held rows can only go once nothing points at them.
		await db.delete(event).where(
			inArray(
				event.id,
				stale.map((e) => e.id)
			)
		);

		const reservationIds = stale.map((e) => e.reservationId).filter((id): id is string => !!id);
		if (reservationIds.length > 0) {
			await db.delete(reservation).where(inArray(reservation.id, reservationIds));
		}

		// A reservation whose event insert was rolled back carries no link back, so
		// sweep by booker as well.
		await db.delete(reservation).where(
			and(
				eq(reservation.bookerType, 'event'),
				inArray(
					reservation.bookerId,
					stale.map((e) => e.id)
				)
			)
		);
	});
}
