/**
 * Prepare the practice space for the staff event-creation e2e.
 *
 * Mostly this *clears* rather than seeds: the test creates its event through the
 * real UI, and what it needs is the absence of last run's event. That event
 * holds a confirmed practice-space reservation for a fixed window, so a second
 * run booking the same window is rejected as a genuine conflict and the suite
 * fails on a stale row rather than on the code under test.
 *
 * It does seed one row: a reservation blocking a *second* window, giving the
 * conflict-warning path something deterministic to collide with.
 *
 * Idempotent: deletes and recreates its own rows on every run.
 *
 * Mirrors the D1 access pattern in seed-staff-user.ts.
 */
import { and, eq, inArray, like } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { withPlatformDb } from './platform-db';
import { event } from '../../src/lib/server/db/schema/event';
import { reservation } from '../../src/lib/server/db/schema/reservation';
import { buildTimeRangeInTz } from '../../src/lib/server/reservation/timezone';
import { SEED_STAFF_ID } from './seed-staff-user';

/** Titles the test creates are prefixed with this so they can be found again. */
export const SEED_EVENT_TITLE_PREFIX = 'E2E Reserved Show';

/** The window the test holds. Far enough out that no other fixture collides. */
export const SEED_EVENT_DATE = '2030-06-15';
export const SEED_EVENT_START = '19:00';
export const SEED_EVENT_END = '22:00';

/**
 * A separate day, already fully booked, for the conflict-warning test. Kept off
 * SEED_EVENT_DATE so the two tests can never collide with each other.
 */
export const SEED_CONFLICT_ID = 'e2e-staff-event-conflict';
export const SEED_CONFLICT_DATE = '2030-06-16';
export const SEED_CONFLICT_START = '19:00';
export const SEED_CONFLICT_END = '22:00';

/**
 * Two more days for the edit tests. Each books a hold of its own, so they get a
 * day each — sharing one would make the second test collide with the first
 * test's booking rather than with the thing it means to assert.
 */
export const SEED_EDIT_EVENT_DATE = '2030-06-17';
export const SEED_SELF_CONFLICT_DATE = '2030-06-18';

/**
 * The day the reservation-list test books. A day of its own for the same reason:
 * sharing SEED_EVENT_DATE would collide with the creation test's own hold.
 */
export const SEED_LIST_LINK_DATE = '2030-06-19';

/** The club's wall clock — the times above are entered in it, as staff would. */
const CLUB_TZ = 'America/Los_Angeles';

export async function seedStaffEvent() {
	await withPlatformDb(async (db) => {
		await clearStaleEvents(db);
		await seedBlockedWindow(db);
	});
}

/** Drop the event (and held space) the previous run created through the UI. */
async function clearStaleEvents(db: DrizzleD1Database) {
	const stale = await db
		.select({ id: event.id, reservationId: event.reservationId })
		.from(event)
		.where(like(event.title, `${SEED_EVENT_TITLE_PREFIX}%`));

	if (stale.length === 0) return;
	const ids = stale.map((e) => e.id);

	// Events first: `event.reservation_id` is a foreign key into reservation, so
	// the held rows can only go once nothing points at them.
	await db.delete(event).where(inArray(event.id, ids));

	const reservationIds = stale.map((e) => e.reservationId).filter((id): id is string => !!id);
	if (reservationIds.length > 0) {
		await db.delete(reservation).where(inArray(reservation.id, reservationIds));
	}

	// A reservation whose event insert was rolled back carries no link back, so
	// sweep by booker as well.
	await db
		.delete(reservation)
		.where(and(eq(reservation.bookerType, 'event'), inArray(reservation.bookerId, ids)));
}

/** Hold SEED_CONFLICT_DATE so the modal's conflict warning has to fire. */
async function seedBlockedWindow(db: DrizzleD1Database) {
	await db.delete(reservation).where(eq(reservation.id, SEED_CONFLICT_ID));

	const { startsAt, endsAt } = buildTimeRangeInTz(
		SEED_CONFLICT_DATE,
		SEED_CONFLICT_START,
		SEED_CONFLICT_END,
		CLUB_TZ
	);

	await db.insert(reservation).values({
		id: SEED_CONFLICT_ID,
		bookerType: 'user',
		bookerId: SEED_STAFF_ID,
		createdByUserId: SEED_STAFF_ID,
		status: 'confirmed',
		startsAt,
		endsAt,
		notes: 'e2e: blocks the window the conflict-warning test books'
	});
}
