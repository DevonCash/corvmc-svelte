import { db, getRowCount } from '$lib/server/db';
import { event, type EventSource } from '$lib/server/db/schema/event';
import { band, bandMember } from '$lib/server/db/schema/band';
import { user } from '$lib/server/db/schema/authentication';
import { reservation } from '$lib/server/db/schema/reservation';
import { ticket } from '$lib/server/db/schema/ticket';
import {
	eq,
	and,
	gt,
	gte,
	lt,
	lte,
	ne,
	asc,
	desc,
	inArray,
	count,
	getTableColumns
} from 'drizzle-orm';
import { paginate, type PaginationInput } from '$lib/server/db/paginate';
import { staffCreate } from '$lib/server/reservation/reservation-service';
import { cancel as cancelReservation } from '$lib/server/reservation/reservation-service';
import { hasConflict } from '$lib/server/reservation/conflict-service';
import { captureException } from '$lib/server/sentry';
import { uploadFile, deleteObject } from '$lib/server/storage';
import { ReservationConflictError } from '$lib/server/reservation/reservation-service';
import { domainEvents } from '$lib/server/events/event-bus';
import {
	formatDateFull,
	formatDateInTz,
	buildDateInTz,
	nextDay
} from '$lib/server/reservation/timezone';
import { DEFAULT_TIMEZONE } from '$lib/config';

// ---------------------------------------------------------------------------
// EventService — create, update, publish, cancel events
// ---------------------------------------------------------------------------

export type { EventStatus } from '$lib/server/db/schema/event';

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
	bandId: string | null;
	source: string;
	location: string | null;
	externalTicketUrl: string | null;
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

	// Validate ticketing fields. The price is what an attendee pays wherever they
	// buy — our checkout, an off-site seller, or the door — so it stands on its
	// own; only selling through us makes it mandatory.
	if (ticketingEnabled && (ticketPrice == null || ticketPrice <= 0)) {
		throw new Error('Ticket price is required when ticketing is enabled');
	}
	assertValidTicketPrice(ticketPrice);

	// D1 has no interactive transactions, so we order the writes so the event row
	// is never persisted in a half-linked state: check conflicts, create the
	// reservation first, then insert the event with the link already set. If the
	// event insert fails, compensate by deleting the just-created reservation.
	const eventId = crypto.randomUUID();

	let reservationId: string | null = null;
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
			bookerId: eventId,
			startsAt: reservationParams.startsAt,
			endsAt: reservationParams.endsAt,
			status: 'confirmed'
		});
		reservationId = res.id;
	}

	let row: EventRow;
	try {
		[row] = await db
			.insert(event)
			.values({
				id: eventId,
				title,
				description: description ?? null,
				startsAt,
				endsAt,
				doorsAt: doorsAt ?? null,
				tags: tags ?? null,
				ticketingEnabled,
				ticketPrice: ticketPrice ?? null,
				// Capacity is only meaningful while we're the ones counting.
				ticketQuantity: ticketingEnabled ? (ticketQuantity ?? null) : null,
				reservationId,
				createdByUserId
			})
			.returning();
	} catch (err) {
		// Compensating write: the event never persisted, so remove the orphan
		// reservation we created for it.
		if (reservationId) {
			try {
				await db.delete(reservation).where(eq(reservation.id, reservationId));
			} catch (cleanupErr) {
				captureException(cleanupErr, { event: 'event.create.compensate', reservationId });
			}
		}
		throw err;
	}

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
	location?: string | null;
	externalTicketUrl?: string | null;
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

/**
 * Reject a backwards range on update, against the times the row will end up
 * with — the same guard create() applies. Without it the range reaches D1 as a
 * raw `event_time_order` CHECK-constraint failure (a 500 with no explanation).
 */
function assertTimeOrder(
	existing: { startsAt: Date; endsAt: Date },
	params: { startsAt?: Date; endsAt?: Date }
): void {
	const startsAt = params.startsAt ?? existing.startsAt;
	const endsAt = params.endsAt ?? existing.endsAt;
	if (startsAt >= endsAt) throw new Error('Event must end after it starts');
}

/** A stored ticket price is either null (no price) or a positive whole-cent integer. */
function assertValidTicketPrice(price: number | null | undefined): void {
	if (price == null) return;
	if (!Number.isInteger(price) || price <= 0) {
		throw new Error('Ticket price must be a positive amount');
	}
}

export async function update(eventId: string, params: UpdateEventParams): Promise<EventRow> {
	const existing = await getById(eventId);
	if (!existing) throw new Error('Event not found');
	if (existing.status === 'cancelled') throw new Error('Cannot update a cancelled event');
	assertTimeOrder(existing, params);

	const updates: Record<string, unknown> = { updatedAt: new Date() };
	if (params.title !== undefined) updates.title = params.title;
	if (params.description !== undefined) updates.description = params.description;
	if (params.startsAt !== undefined) updates.startsAt = params.startsAt;
	if (params.endsAt !== undefined) updates.endsAt = params.endsAt;
	if (params.doorsAt !== undefined) updates.doorsAt = params.doorsAt;
	if (params.tags !== undefined) updates.tags = params.tags;
	if (params.location !== undefined) updates.location = params.location;
	if (params.externalTicketUrl !== undefined) {
		updates.externalTicketUrl = params.externalTicketUrl;
	}

	// A band gig is never sold through *our* checkout. The money would land in
	// CMC's Stripe account with no payout path back to the band, so the rule is
	// absolute rather than a band-vs-staff permission: `createBandEvent` cannot
	// set `ticketingEnabled`, and this is the only other writer that can.
	//
	// Scoped to `ticketingEnabled` alone. A band gig legitimately carries a
	// `ticketPrice` — it is a display price for the door or an outside seller,
	// and the band event forms let bands set one — and `externalTicketUrl` is
	// how a band sells at all. Only the platform-checkout flag is off limits.
	if (existing.source === 'band' && params.ticketingEnabled === true) {
		throw new Error('Band events cannot be ticketed through CMC');
	}

	// Ticketing fields. The price survives whatever happens to the ticketing
	// toggle — switching our checkout off doesn't make the show free, it just
	// means somebody else (or the door) takes the money. Capacity does not: it's
	// only enforceable while we're selling.
	if (params.ticketPrice !== undefined) {
		assertValidTicketPrice(params.ticketPrice);
		updates.ticketPrice = params.ticketPrice;
	}

	if (params.ticketingEnabled !== undefined) {
		updates.ticketingEnabled = params.ticketingEnabled;
		if (params.ticketingEnabled) {
			const price = params.ticketPrice === undefined ? existing.ticketPrice : params.ticketPrice;
			if (price == null) {
				throw new Error('Ticket price is required when ticketing is enabled');
			}
			updates.ticketQuantity = params.ticketQuantity ?? null;
		} else {
			updates.ticketQuantity = null;
		}
	} else if (params.ticketQuantity !== undefined) {
		updates.ticketQuantity = params.ticketQuantity;
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
			const conflict = await hasConflict(
				reservationStartsAt,
				reservationEndsAt,
				existing.reservationId
			);
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
			// Event space is staff-held for drafts too: there is no member confirm/pay
			// flow for it and publish() never touches the reservation, so a
			// `scheduled` hold could only ever be swept away as unconfirmed.
			status: 'confirmed'
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

	const [updated] = await db.update(event).set(updates).where(eq(event.id, eventId)).returning();

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

	if (getRowCount(result) === 0) {
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

/**
 * Unpublish and, for a band-sourced event, tell the band's admins so they can
 * fix the listing and republish. Pulling a band's gig without a word is the one
 * thing staff must not be able to do by accident, so both entry points — the
 * moderation queue and the staff event page — go through here.
 *
 * No-ops when the event is already off the guide, which is what makes it safe
 * to call from the flag queue after another staff member got there first.
 */
export async function unpublishWithBandNotice(
	eventId: string,
	opts: { notes?: string } = {}
): Promise<void> {
	const [row] = await db
		.select({
			id: event.id,
			title: event.title,
			status: event.status,
			source: event.source,
			bandId: event.bandId,
			bandName: band.name
		})
		.from(event)
		.leftJoin(band, eq(band.id, event.bandId))
		.where(eq(event.id, eventId))
		.limit(1);

	if (!row || row.status !== 'published') return;

	await unpublish(eventId);

	if (row.source !== 'band' || !row.bandId || !row.bandName) return;

	const admins = await db
		.select({ id: user.id, name: user.name, email: user.email })
		.from(bandMember)
		.innerJoin(user, eq(user.id, bandMember.userId))
		.where(
			and(
				eq(bandMember.bandId, row.bandId),
				inArray(bandMember.role, ['owner', 'admin']),
				eq(bandMember.status, 'active')
			)
		);

	const payload = {
		eventId: row.id,
		eventTitle: row.title,
		bandId: row.bandId,
		bandName: row.bandName,
		notes: opts.notes || null,
		bandAdmins: admins.map((u) => ({ userId: u.id, userName: u.name, userEmail: u.email }))
	};

	// Fire-and-forget: don't block the staff action on notification fan-out.
	Promise.resolve().then(async () => {
		try {
			await domainEvents.emit('event.unpublished_by_staff', payload);
		} catch (err) {
			captureException(err, { event: 'event.unpublished_by_staff', eventId });
		}
	});
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
		.where(and(eq(event.id, eventId), ne(event.status, 'cancelled')));

	if (getRowCount(result) === 0) throw new Error('Event status changed concurrently');

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

	// Capture ticket holders before voiding their tickets (the query below
	// filters on live statuses), then mark the tickets cancelled so they can't
	// be checked in against a cancelled event. Checked-in tickets are left as-is.
	const tickets = await db
		.select({
			attendeeName: ticket.attendeeName,
			attendeeEmail: ticket.attendeeEmail,
			userId: ticket.userId
		})
		.from(ticket)
		.where(and(eq(ticket.eventId, eventId), inArray(ticket.status, ['valid', 'pending'])))
		.limit(5000);

	await db
		.update(ticket)
		.set({ status: 'cancelled', updatedAt: new Date() })
		.where(and(eq(ticket.eventId, eventId), inArray(ticket.status, ['valid', 'pending'])));

	// Emit domain event for every cancellation (fire-and-forget). This fires
	// even when no tickets were sold — the event is the signal that a show was
	// cancelled, not just a notification trigger, and cancelling before any
	// tickets move is the common case. Listeners that only notify holders
	// iterate `ticketHolders` and do nothing when it's empty.
	Promise.resolve().then(async () => {
		try {
			// Deduplicate by email (one notification per buyer)
			const seen = new Set<string>();
			const holders = tickets.filter((t) => {
				if (seen.has(t.attendeeEmail)) return false;
				seen.add(t.attendeeEmail);
				return true;
			});

			await domainEvents.emit('event.cancelled', {
				eventId,
				eventTitle: existing.title,
				eventDate: formatDateFull(existing.startsAt, DEFAULT_TIMEZONE),
				ticketHolders: holders.map((h) => ({
					attendeeName: h.attendeeName,
					attendeeEmail: h.attendeeEmail,
					userId: h.userId ?? undefined
				})),
				// Refunds are handled manually by staff — do not promise automatic
				// processing (no auto-refund flow exists; see tickets-spec deferred).
				refundNote:
					'If you purchased tickets, CMC staff will reach out about your refund. Questions? Reply to this email.'
			});
		} catch (err) {
			captureException(err, { event: 'event.cancelled', eventId });
		}
	});
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getById(eventId: string): Promise<EventRow | null> {
	const [row] = await db.select().from(event).where(eq(event.id, eventId)).limit(1);

	return row ?? null;
}

/** Published CMC events with startsAt in the future, ordered by date. */
export async function listUpcoming(limit?: number): Promise<EventRow[]> {
	const query = db
		.select()
		.from(event)
		.where(
			and(eq(event.status, 'published'), eq(event.source, 'cmc'), gt(event.startsAt, new Date()))
		)
		.orderBy(asc(event.startsAt));

	if (limit) return query.limit(limit);
	return query;
}

/** Soonest published CMC show on today's calendar day (PT) that hasn't ended yet. */
export async function getShowTonight(now = new Date()): Promise<EventRow | null> {
	const today = formatDateInTz(now, DEFAULT_TIMEZONE);
	const dayStart = buildDateInTz(today, '00:00', DEFAULT_TIMEZONE);
	const dayEnd = buildDateInTz(nextDay(today), '00:00', DEFAULT_TIMEZONE);

	const [row] = await db
		.select()
		.from(event)
		.where(
			and(
				eq(event.status, 'published'),
				eq(event.source, 'cmc'),
				gte(event.startsAt, dayStart),
				lt(event.startsAt, dayEnd),
				gt(event.endsAt, now)
			)
		)
		.orderBy(asc(event.startsAt))
		.limit(1);

	return row ?? null;
}

/** Published events that have already ended, newest first. */
export async function listPast(limit?: number): Promise<EventRow[]> {
	const query = db
		.select()
		.from(event)
		.where(
			and(eq(event.status, 'published'), eq(event.source, 'cmc'), lte(event.startsAt, new Date()))
		)
		.orderBy(desc(event.startsAt));

	if (limit) return query.limit(limit);
	return query;
}

/**
 * All events for staff, newest first. Band-sourced events sit in the same list
 * as CMC ones, so the band name rides along — without it a band's gig is
 * indistinguishable from a show the space is producing.
 */
export async function listAll(
	opts: { source?: EventSource } = {},
	pagination: PaginationInput = {}
) {
	const where = opts.source ? eq(event.source, opts.source) : undefined;

	const dataQ = db
		.select({ ...getTableColumns(event), bandName: band.name, bandSlug: band.slug })
		.from(event)
		.leftJoin(band, eq(band.id, event.bandId))
		.where(where)
		.orderBy(desc(event.startsAt))
		.$dynamic();
	const countQ = db.select({ count: count() }).from(event).where(where);
	return paginate(dataQ, countQ, pagination);
}

// ---------------------------------------------------------------------------
// Band Events
// ---------------------------------------------------------------------------

export interface CreateBandEventParams {
	bandId: string;
	createdByUserId: string;
	title: string;
	description?: string;
	startsAt: Date;
	endsAt: Date;
	doorsAt?: Date;
	location?: string;
	tags?: string;
	externalTicketUrl?: string;
	/** Door / off-site price in cents. Bands never sell through our checkout. */
	ticketPrice?: number | null;
	posterFile?: {
		buffer: ArrayBuffer;
		contentType: string;
	};
}

export async function createBandEvent(params: CreateBandEventParams): Promise<EventRow> {
	const {
		bandId,
		createdByUserId,
		title,
		description,
		startsAt,
		endsAt,
		doorsAt,
		location,
		tags,
		externalTicketUrl,
		ticketPrice,
		posterFile
	} = params;

	if (startsAt >= endsAt) throw new Error('Event must end after it starts');
	if (doorsAt && doorsAt > startsAt) throw new Error('Doors must open before event starts');
	assertValidTicketPrice(ticketPrice);

	const [row] = await db
		.insert(event)
		.values({
			title,
			description: description ?? null,
			startsAt,
			endsAt,
			doorsAt: doorsAt ?? null,
			tags: tags ?? null,
			location: location ?? null,
			externalTicketUrl: externalTicketUrl ?? null,
			ticketPrice: ticketPrice ?? null,
			bandId,
			source: 'band',
			createdByUserId
		})
		.returning();

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

export interface UpdateBandEventParams {
	title?: string;
	description?: string | null;
	startsAt?: Date;
	endsAt?: Date;
	doorsAt?: Date | null;
	location?: string | null;
	tags?: string | null;
	externalTicketUrl?: string | null;
	ticketPrice?: number | null;
	posterFile?: {
		buffer: ArrayBuffer;
		contentType: string;
	};
}

export async function updateBandEvent(
	eventId: string,
	bandId: string,
	params: UpdateBandEventParams
): Promise<EventRow> {
	const existing = await getById(eventId);
	if (!existing) throw new Error('Event not found');
	if (existing.bandId !== bandId) throw new Error('Event does not belong to this band');
	if (existing.status === 'cancelled') throw new Error('Cannot update a cancelled event');
	assertTimeOrder(existing, params);

	const updates: Record<string, unknown> = { updatedAt: new Date() };
	if (params.title !== undefined) updates.title = params.title;
	if (params.description !== undefined) updates.description = params.description;
	if (params.startsAt !== undefined) updates.startsAt = params.startsAt;
	if (params.endsAt !== undefined) updates.endsAt = params.endsAt;
	if (params.doorsAt !== undefined) updates.doorsAt = params.doorsAt;
	if (params.location !== undefined) updates.location = params.location;
	if (params.tags !== undefined) updates.tags = params.tags;
	if (params.externalTicketUrl !== undefined) updates.externalTicketUrl = params.externalTicketUrl;
	if (params.ticketPrice !== undefined) {
		assertValidTicketPrice(params.ticketPrice);
		updates.ticketPrice = params.ticketPrice;
	}

	if (params.posterFile) {
		if (existing.posterKey) {
			await deleteObject(existing.posterKey);
		}
		const ext = extensionFromType(params.posterFile.contentType);
		const key = `events/posters/${eventId}.${ext}`;
		await uploadFile(params.posterFile.buffer, key, params.posterFile.contentType);
		updates.posterKey = key;
	}

	const [updated] = await db.update(event).set(updates).where(eq(event.id, eventId)).returning();

	return updated;
}

export async function cancelBandEvent(eventId: string, bandId: string): Promise<void> {
	const existing = await getById(eventId);
	if (!existing) throw new Error('Event not found');
	if (existing.bandId !== bandId) throw new Error('Event does not belong to this band');
	if (existing.status === 'cancelled') throw new Error('Event is already cancelled');

	await db
		.update(event)
		.set({ status: 'cancelled', updatedAt: new Date() })
		.where(eq(event.id, eventId));

	if (existing.posterKey) {
		await deleteObject(existing.posterKey);
	}
}

/** Published band events with startsAt in the future. */
export async function listBandEventsUpcoming(bandId: string, limit?: number): Promise<EventRow[]> {
	const query = db
		.select()
		.from(event)
		.where(
			and(eq(event.bandId, bandId), eq(event.status, 'published'), gt(event.startsAt, new Date()))
		)
		.orderBy(asc(event.startsAt));

	if (limit) return query.limit(limit);
	return query;
}

/** All events for a band (all statuses), newest first. */
export async function listBandEvents(bandId: string): Promise<EventRow[]> {
	return db.select().from(event).where(eq(event.bandId, bandId)).orderBy(desc(event.startsAt));
}

/** Count of a band's published past shows — the legacy / veteran signal. */
export async function countBandPastEvents(bandId: string): Promise<number> {
	const [row] = await db
		.select({ value: count() })
		.from(event)
		.where(
			and(eq(event.bandId, bandId), eq(event.status, 'published'), lte(event.startsAt, new Date()))
		);
	return row?.value ?? 0;
}

/**
 * Published band shows already played, newest first. Fetches limit+1 rows so
 * callers can derive hasMore.
 */
export async function listBandEventsPast(
	bandId: string,
	opts: { limit: number; offset: number }
): Promise<EventRow[]> {
	return db
		.select()
		.from(event)
		.where(
			and(eq(event.bandId, bandId), eq(event.status, 'published'), lte(event.startsAt, new Date()))
		)
		.orderBy(desc(event.startsAt))
		.limit(opts.limit + 1)
		.offset(opts.offset);
}

export interface MemberShowRow extends EventRow {
	bandName: string;
	bandSlug: string;
}

/**
 * Upcoming published shows aggregated across all of a member's *active* bands,
 * each tagged with the band it belongs to. Soonest first.
 */
export async function listMemberUpcomingShows(userId: string): Promise<MemberShowRow[]> {
	const rows = await db
		.select({ event, bandName: band.name, bandSlug: band.slug })
		.from(event)
		.innerJoin(band, eq(band.id, event.bandId))
		.innerJoin(
			bandMember,
			and(
				eq(bandMember.bandId, band.id),
				eq(bandMember.userId, userId),
				eq(bandMember.status, 'active')
			)
		)
		.where(and(eq(event.status, 'published'), gt(event.startsAt, new Date())))
		.orderBy(asc(event.startsAt));

	return rows.map((r) => ({ ...r.event, bandName: r.bandName, bandSlug: r.bandSlug }));
}

/**
 * Past published shows across a member's active bands, newest first. Fetches
 * limit+1 rows so callers can derive hasMore.
 */
export async function listMemberPastShows(
	userId: string,
	opts: { limit: number; offset: number }
): Promise<MemberShowRow[]> {
	const rows = await db
		.select({ event, bandName: band.name, bandSlug: band.slug })
		.from(event)
		.innerJoin(band, eq(band.id, event.bandId))
		.innerJoin(
			bandMember,
			and(
				eq(bandMember.bandId, band.id),
				eq(bandMember.userId, userId),
				eq(bandMember.status, 'active')
			)
		)
		.where(and(eq(event.status, 'published'), lte(event.startsAt, new Date())))
		.orderBy(desc(event.startsAt))
		.limit(opts.limit + 1)
		.offset(opts.offset);

	return rows.map((r) => ({ ...r.event, bandName: r.bandName, bandSlug: r.bandSlug }));
}

/** Count of past published shows across a member's active bands. */
export async function countMemberPastShows(userId: string): Promise<number> {
	const [row] = await db
		.select({ value: count() })
		.from(event)
		.innerJoin(
			bandMember,
			and(
				eq(bandMember.bandId, event.bandId),
				eq(bandMember.userId, userId),
				eq(bandMember.status, 'active')
			)
		)
		.where(and(eq(event.status, 'published'), lte(event.startsAt, new Date())));
	return row?.value ?? 0;
}

// ---------------------------------------------------------------------------
// Public calendar
// ---------------------------------------------------------------------------

export interface CalendarEventRow extends EventRow {
	bandName: string | null;
	bandSlug: string | null;
}

/**
 * Published events with startsAt in [start, end), across sources, band info
 * joined for attribution. Band events are excluded unless includeBandEvents
 * (the bandEvents feature flag) is set.
 */
export async function listPublicCalendarEvents(
	start: Date,
	end: Date,
	opts: { includeBandEvents: boolean }
): Promise<CalendarEventRow[]> {
	const rows = await db
		.select({ event, bandName: band.name, bandSlug: band.slug })
		.from(event)
		.leftJoin(band, eq(band.id, event.bandId))
		.where(
			and(
				eq(event.status, 'published'),
				gte(event.startsAt, start),
				lt(event.startsAt, end),
				opts.includeBandEvents ? undefined : eq(event.source, 'cmc')
			)
		)
		.orderBy(asc(event.startsAt));

	return rows.map((r) => ({ ...r.event, bandName: r.bandName, bandSlug: r.bandSlug }));
}

/**
 * Published events from `from` forward, across sources, ordered soonest-first,
 * band info joined. Fetches limit+1 rows so callers can derive hasMore; band
 * events are excluded unless includeBandEvents (the bandEvents feature flag).
 */
export async function listPublicUpcomingEvents(
	from: Date,
	opts: { includeBandEvents: boolean; limit: number; offset: number }
): Promise<CalendarEventRow[]> {
	const rows = await db
		.select({ event, bandName: band.name, bandSlug: band.slug })
		.from(event)
		.leftJoin(band, eq(band.id, event.bandId))
		.where(
			and(
				eq(event.status, 'published'),
				gte(event.startsAt, from),
				opts.includeBandEvents ? undefined : eq(event.source, 'cmc')
			)
		)
		.orderBy(asc(event.startsAt))
		.limit(opts.limit + 1)
		.offset(opts.offset);

	return rows.map((r) => ({ ...r.event, bandName: r.bandName, bandSlug: r.bandSlug }));
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
