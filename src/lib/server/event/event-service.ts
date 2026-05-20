import { db } from '$lib/server/db';
import { event } from '$lib/server/db/schema/event';
import { user } from '$lib/server/db/schema/auth';
import { reservation } from '$lib/server/db/schema/reservation';
import { ticket } from '$lib/server/db/schema/ticket';
import { eq, and, gt, ne, asc, desc, inArray, count } from 'drizzle-orm';
import { paginate, type PaginationInput } from '$lib/server/db/paginate';
import { staffCreate } from '$lib/server/reservation/reservation-service';
import { cancel as cancelReservation } from '$lib/server/reservation/reservation-service';
import { hasConflict } from '$lib/server/reservation/conflict-service';
import { captureException } from '$lib/server/sentry';
import { uploadFile, deleteObject } from '$lib/server/storage';
import { ReservationConflictError } from '$lib/server/reservation/reservation-service';
import { domainEvents } from '$lib/server/events/event-bus';
import { DateTime } from 'luxon';

// ---------------------------------------------------------------------------
// EventService — create, update, publish, cancel events
// ---------------------------------------------------------------------------

export type EventStatus = 'draft' | 'published' | 'cancelled';

export interface EventRow {
	id: string;
	title: string;
	description: string | null;
	startsAt: Date;
	endsAt: Date;
	doorsAt: Date | null;
	status: string;
	publishedAt: Date | null;
	reservationId: string | null;
	posterKey: string | null;
	tags: string | null;
	ticketingEnabled: boolean;
	ticketPrice: number | null;
	ticketQuantity: number | null;
	createdByUserId: string;
	createdAt: Date;
	updatedAt: Date;
}

// ---------------------------------------------------------------------------
// create()
// ---------------------------------------------------------------------------

export interface CreateEventParams {
	title: string;
	description?: string;
	startsAt: Date;
	endsAt: Date;
	doorsAt?: Date;
	tags?: string;
	ticketingEnabled?: boolean;
	ticketPrice?: number | null;
	ticketQuantity?: number | null;
	createdByUserId: string;
	reservation?: {
		startsAt: Date;
		endsAt: Date;
		overrideConflicts: boolean;
	};
	posterFile?: {
		buffer: ArrayBuffer;
		contentType: string;
	};
}

export async function create(params: CreateEventParams): Promise<EventRow> {
	const {
		title,
		description,
		startsAt,
		endsAt,
		doorsAt,
		tags,
		ticketingEnabled = false,
		ticketPrice,
		ticketQuantity,
		createdByUserId,
		reservation: reservationParams,
		posterFile
	} = params;

	if (startsAt >= endsAt) throw new Error('Event must end after it starts');
	if (doorsAt && doorsAt > startsAt) throw new Error('Doors must open before event starts');

	// Validate ticketing fields
	if (ticketingEnabled && (ticketPrice == null || ticketPrice <= 0)) {
		throw new Error('Ticket price is required when ticketing is enabled');
	}

	// Insert event + optional reservation in a transaction
	const row = await db.transaction(async (tx) => {
		// Insert the event first to get the ID
		const [newEvent] = await tx
			.insert(event)
			.values({
				title,
				description: description ?? null,
				startsAt,
				endsAt,
				doorsAt: doorsAt ?? null,
				tags: tags ?? null,
				ticketingEnabled,
				ticketPrice: ticketingEnabled ? ticketPrice! : null,
				ticketQuantity: ticketingEnabled ? (ticketQuantity ?? null) : null,
				createdByUserId
			})
			.returning();

		// Create linked reservation if requested
		if (reservationParams) {
			if (!reservationParams.overrideConflicts) {
				const conflict = await hasConflict(reservationParams.startsAt, reservationParams.endsAt);
				if (conflict) {
					throw new ReservationConflictError();
				}
			}

			const res = await staffCreate({
				userId: createdByUserId,
				bookerType: 'event',
				bookerId: newEvent.id,
				startsAt: reservationParams.startsAt,
				endsAt: reservationParams.endsAt,
				status: 'confirmed'
			});

			await tx
				.update(event)
				.set({ reservationId: res.id, updatedAt: new Date() })
				.where(eq(event.id, newEvent.id));

			newEvent.reservationId = res.id;
		}

		return newEvent;
	});

	// Upload poster outside the transaction (non-critical, idempotent)
	if (posterFile) {
		const ext = extensionFromType(posterFile.contentType);
		const key = `events/posters/${row.id}.${ext}`;
		await uploadFile(posterFile.buffer, key, posterFile.contentType);
		await db
			.update(event)
			.set({ posterKey: key, updatedAt: new Date() })
			.where(eq(event.id, row.id));
		row.posterKey = key;
	}

	return row;
}

// ---------------------------------------------------------------------------
// update()
// ---------------------------------------------------------------------------

export interface UpdateEventParams {
	title?: string;
	description?: string | null;
	startsAt?: Date;
	endsAt?: Date;
	doorsAt?: Date | null;
	tags?: string | null;
	ticketingEnabled?: boolean;
	ticketPrice?: number | null;
	ticketQuantity?: number | null;
	posterFile?: {
		buffer: ArrayBuffer;
		contentType: string;
	};
	/** When times change and a linked reservation exists, rebook it. */
	rebook?: {
		userId: string;
		reservationStartsAt: Date;
		reservationEndsAt: Date;
		overrideConflicts: boolean;
	};
}

/**
 * Check whether an event's time change would require rebooking its reservation.
 * Returns null if no rebook is needed, or an object describing the situation.
 */
export async function checkRebookNeeded(
	eventId: string,
	newStartsAt: Date,
	newEndsAt: Date
): Promise<{
	needed: boolean;
	currentReservation: { id: string; startsAt: Date; endsAt: Date } | null;
	reason: string | null;
}> {
	const evt = await getById(eventId);
	if (!evt) throw new Error('Event not found');

	if (!evt.reservationId) {
		return { needed: false, currentReservation: null, reason: null };
	}

	const [res] = await db
		.select({ id: reservation.id, startsAt: reservation.startsAt, endsAt: reservation.endsAt })
		.from(reservation)
		.where(eq(reservation.id, evt.reservationId))
		.limit(1);

	if (!res) {
		return { needed: false, currentReservation: null, reason: null };
	}

	const currentRes = { id: res.id, startsAt: res.startsAt, endsAt: res.endsAt };

	// Rebook needed if new event times extend outside the current reservation window
	const extendsEarlier = newStartsAt.getTime() < res.startsAt.getTime();
	const extendsLater = newEndsAt.getTime() > res.endsAt.getTime();

	if (!extendsEarlier && !extendsLater) {
		return { needed: false, currentReservation: currentRes, reason: null };
	}

	const reasons: string[] = [];
	if (extendsEarlier) reasons.push('starts earlier than the current reservation');
	if (extendsLater) reasons.push('ends later than the current reservation');

	return {
		needed: true,
		currentReservation: currentRes,
		reason: `New event time ${reasons.join(' and ')}`
	};
}

export async function update(eventId: string, params: UpdateEventParams): Promise<EventRow> {
	const existing = await getById(eventId);
	if (!existing) throw new Error('Event not found');
	if (existing.status === 'cancelled') throw new Error('Cannot update a cancelled event');

	const updates: Record<string, unknown> = { updatedAt: new Date() };
	if (params.title !== undefined) updates.title = params.title;
	if (params.description !== undefined) updates.description = params.description;
	if (params.startsAt !== undefined) updates.startsAt = params.startsAt;
	if (params.endsAt !== undefined) updates.endsAt = params.endsAt;
	if (params.doorsAt !== undefined) updates.doorsAt = params.doorsAt;
	if (params.tags !== undefined) updates.tags = params.tags;

	// Ticketing fields
	if (params.ticketingEnabled !== undefined) {
		updates.ticketingEnabled = params.ticketingEnabled;
		if (params.ticketingEnabled) {
			if (params.ticketPrice == null || params.ticketPrice <= 0) {
				throw new Error('Ticket price is required when ticketing is enabled');
			}
			updates.ticketPrice = params.ticketPrice;
			updates.ticketQuantity = params.ticketQuantity ?? null;
		} else {
			updates.ticketPrice = null;
			updates.ticketQuantity = null;
		}
	} else {
		if (params.ticketPrice !== undefined) updates.ticketPrice = params.ticketPrice;
		if (params.ticketQuantity !== undefined) updates.ticketQuantity = params.ticketQuantity;
	}

	// Handle reservation rebooking if requested
	if (params.rebook && existing.reservationId) {
		const { userId, reservationStartsAt, reservationEndsAt, overrideConflicts } = params.rebook;

		// Cancel existing reservation
		try {
			await cancelReservation(existing.reservationId, userId, 'Event times changed — rebooking', {
				staffOverride: true
			});
		} catch {
			// Already cancelled — continue
		}

		// Create new reservation
		if (!overrideConflicts) {
			const conflict = await hasConflict(reservationStartsAt, reservationEndsAt, existing.reservationId);
			if (conflict) {
				throw new ReservationConflictError();
			}
		}

		const newRes = await staffCreate({
			userId,
			bookerType: 'event',
			bookerId: eventId,
			startsAt: reservationStartsAt,
			endsAt: reservationEndsAt,
			status: existing.status === 'draft' ? 'scheduled' : 'confirmed'
		});

		updates.reservationId = newRes.id;
	}

	// Handle poster replacement
	if (params.posterFile) {
		if (existing.posterKey) {
			await deleteObject(existing.posterKey);
		}
		const ext = extensionFromType(params.posterFile.contentType);
		const key = `events/posters/${eventId}.${ext}`;
		await uploadFile(params.posterFile.buffer, key, params.posterFile.contentType);
		updates.posterKey = key;
	}

	const [updated] = await db
		.update(event)
		.set(updates)
		.where(eq(event.id, eventId))
		.returning();

	return updated;
}

// ---------------------------------------------------------------------------
// publish()
// ---------------------------------------------------------------------------

export async function publish(eventId: string): Promise<void> {
	const result = await db
		.update(event)
		.set({ status: 'published', publishedAt: new Date(), updatedAt: new Date() })
		.where(and(eq(event.id, eventId), eq(event.status, 'draft')));

	const rowCount = (result as unknown as { rowCount: number }).rowCount ?? 0;
	if (rowCount === 0) {
		const existing = await getById(eventId);
		if (!existing) throw new Error('Event not found');
		throw new Error(`Cannot publish an event with status "${existing.status}"`);
	}
}

// ---------------------------------------------------------------------------
// unpublish()
// ---------------------------------------------------------------------------

export async function unpublish(eventId: string): Promise<void> {
	const existing = await getById(eventId);
	if (!existing) throw new Error('Event not found');
	if (existing.status !== 'published') {
		throw new Error(`Cannot unpublish an event with status "${existing.status}"`);
	}

	const { getTicketsSold } = await import('$lib/server/ticket/ticket-service');
	const sold = await getTicketsSold(eventId);
	if (sold > 0) {
		throw new Error(`Cannot unpublish: ${sold} ticket(s) have been sold`);
	}

	await db
		.update(event)
		.set({ status: 'draft', publishedAt: null, updatedAt: new Date() })
		.where(and(eq(event.id, eventId), eq(event.status, 'published')));
}

// ---------------------------------------------------------------------------
// cancel()
// ---------------------------------------------------------------------------

export async function cancel(eventId: string, userId: string): Promise<void> {
	const existing = await getById(eventId);
	if (!existing) throw new Error('Event not found');
	if (existing.status === 'cancelled') throw new Error('Event is already cancelled');

	const result = await db
		.update(event)
		.set({ status: 'cancelled', updatedAt: new Date() })
		.where(
			and(
				eq(event.id, eventId),
				ne(event.status, 'cancelled')
			)
		);

	const rowCount = (result as unknown as { rowCount: number }).rowCount ?? 0;
	if (rowCount === 0) throw new Error('Event status changed concurrently');

	// Cancel linked reservation if present
	if (existing.reservationId) {
		try {
			await cancelReservation(existing.reservationId, userId, 'Event cancelled', {
				staffOverride: true
			});
		} catch {
			// Reservation may already be cancelled — ignore
		}
	}

	// Delete poster from R2
	if (existing.posterKey) {
		await deleteObject(existing.posterKey);
	}

	// Emit domain event for ticket holder notifications (fire-and-forget)
	Promise.resolve().then(async () => {
		try {
			const tickets = await db
				.select({
					attendeeName: ticket.attendeeName,
					attendeeEmail: ticket.attendeeEmail,
					userId: ticket.userId
				})
				.from(ticket)
				.where(
					and(
						eq(ticket.eventId, eventId),
						inArray(ticket.status, ['valid', 'pending'])
					)
				)
				.limit(5000);

			// Deduplicate by email (one notification per buyer)
			const seen = new Set<string>();
			const holders = tickets.filter((t) => {
				if (seen.has(t.attendeeEmail)) return false;
				seen.add(t.attendeeEmail);
				return true;
			});

			if (holders.length > 0) {
				const eventDt = DateTime.fromJSDate(existing.startsAt);
				await domainEvents.emit('event.cancelled', {
					eventId,
					eventTitle: existing.title,
					eventDate: eventDt.toLocaleString(DateTime.DATE_FULL),
					ticketHolders: holders.map((h) => ({
						attendeeName: h.attendeeName,
						attendeeEmail: h.attendeeEmail,
						userId: h.userId ?? undefined
					})),
					refundNote: 'Refunds will be processed automatically. Please allow a few business days.'
				});
			}
		} catch (err) {
			captureException(err, { event: 'event.cancelled', eventId });
		}
	});
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getById(eventId: string): Promise<EventRow | null> {
	const [row] = await db
		.select()
		.from(event)
		.where(eq(event.id, eventId))
		.limit(1);

	return row ?? null;
}

/** Published events with startsAt in the future, ordered by date. */
export async function listUpcoming(limit?: number): Promise<EventRow[]> {
	const query = db
		.select()
		.from(event)
		.where(
			and(
				eq(event.status, 'published'),
				gt(event.startsAt, new Date())
			)
		)
		.orderBy(asc(event.startsAt));

	if (limit) return query.limit(limit);
	return query;
}

/** All events for staff, newest first. */
export async function listAll(pagination: PaginationInput = {}) {
	const dataQ = db.select().from(event).orderBy(desc(event.startsAt)).$dynamic();
	const countQ = db.select({ count: count() }).from(event);
	return paginate(dataQ, countQ, pagination);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extensionFromType(contentType: string): string {
	switch (contentType) {
		case 'image/jpeg':
			return 'jpg';
		case 'image/png':
			return 'png';
		case 'image/webp':
			return 'webp';
		default:
			return 'bin';
	}
}
