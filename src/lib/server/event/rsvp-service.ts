import { db } from '$lib/server/db';
import { eventRsvp, type EventRsvp } from '$lib/server/db/schema/event-rsvp';
import { and, eq, sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Lightweight RSVP for non-ticketed events. No codes, no check-in, no capacity —
// just a per-member attendance row. See schema/event-rsvp.ts.
// ---------------------------------------------------------------------------

const MAX_NAME = 120;
const MAX_EMAIL = 254;

export interface CreateRsvpOptions {
	eventId: string;
	userId: string;
	attendeeName: string;
	attendeeEmail: string;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Create an RSVP. Idempotent: a duplicate (eventId, userId) is ignored. */
export async function createRsvp(options: CreateRsvpOptions): Promise<void> {
	const attendeeName = options.attendeeName.trim().slice(0, MAX_NAME);
	const attendeeEmail = options.attendeeEmail.trim().slice(0, MAX_EMAIL);

	await db
		.insert(eventRsvp)
		.values({
			eventId: options.eventId,
			userId: options.userId,
			attendeeName,
			attendeeEmail
		})
		.onConflictDoNothing({ target: [eventRsvp.eventId, eventRsvp.userId] });
}

/** Remove a member's RSVP for an event. No-op if none exists. */
export async function cancelRsvp(eventId: string, userId: string): Promise<void> {
	await db
		.delete(eventRsvp)
		.where(and(eq(eventRsvp.eventId, eventId), eq(eventRsvp.userId, userId)));
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** The current member's RSVP for an event, or null. */
export async function getUserRsvp(eventId: string, userId: string): Promise<EventRsvp | null> {
	const [row] = await db
		.select()
		.from(eventRsvp)
		.where(and(eq(eventRsvp.eventId, eventId), eq(eventRsvp.userId, userId)))
		.limit(1);

	return row ?? null;
}

/** Total RSVPs for an event (derived count, not denormalized). */
export async function countRsvps(eventId: string): Promise<number> {
	const [result] = await db
		.select({ count: sql<number>`cast(count(*) as integer)` })
		.from(eventRsvp)
		.where(eq(eventRsvp.eventId, eventId));

	return result?.count ?? 0;
}
