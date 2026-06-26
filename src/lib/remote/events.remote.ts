import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { query, form, getRequestEvent } from '$app/server';
import { requireStaff, requireUser } from '$lib/server/authorization';
import {
	create,
	update,
	checkRebookNeeded,
	publish,
	unpublish,
	cancel,
	getById,
	listAll as listAllEvents,
	listUpcoming,
	listPast
} from '$lib/server/event/event-service';
import {
	getConflictDetails,
	getValidationWarnings
} from '$lib/server/reservation/conflict-service';
import { buildDateInTz } from '$lib/server/reservation/timezone';
import {
	getTicketsRemaining,
	getTicketsSold,
	getEventTickets,
	getUserTickets,
	getTicketsByPurchase,
	createTickets,
	checkIn,
	cancelTicket as cancelTicketService
} from '$lib/server/ticket/ticket-service';
import {
	createRsvp,
	cancelRsvp as cancelRsvpService,
	getUserRsvp,
	countRsvps
} from '$lib/server/event/rsvp-service';
import { getSubscription } from '$lib/server/finance/subscription-service';
import { checkout } from '$lib/server/finance/payment-service';
import { buildLineItem } from '$lib/server/finance/product-config-service';
import { resolveImageUrl } from '$lib/server/storage';
import { db } from '$lib/server/db';
import { reservation } from '$lib/server/db/schema/reservation';
import { user } from '$lib/server/db/schema/authentication';
import { eq, inArray } from 'drizzle-orm';
import { event, createEventSchema } from '$lib/server/db/schema/event';
import { hasAnyRole } from '$lib/server/authorization';
import { randomUUID } from 'crypto';
import { DEFAULT_TIMEZONE } from '$lib/config';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const getMemberEvents = query(async () => {
	const [upcoming, past] = await Promise.all([listUpcoming(), listPast(12)]);
	const mapEvent = (e: (typeof upcoming)[number]) => ({
		id: e.id,
		title: e.title,
		startsAt: e.startsAt,
		endsAt: e.endsAt,
		doorsAt: e.doorsAt ?? null,
		tags: e.tags as string | null,
		ticketingEnabled: e.ticketingEnabled,
		ticketPrice: e.ticketPrice,
		posterUrl: resolveImageUrl(e.posterKey)
	});
	return { upcoming: upcoming.map(mapEvent), past: past.map(mapEvent) };
});

export const getMemberTickets = query(async () => {
	const currentUser = requireUser();
	const tickets = await getUserTickets(currentUser.id);

	const eventIds = [...new Set(tickets.map((t) => t.eventId))];
	let eventMap: Record<string, { title: string; startsAt: Date; endsAt: Date }> = {};

	if (eventIds.length > 0) {
		const events = await db
			.select({ id: event.id, title: event.title, startsAt: event.startsAt, endsAt: event.endsAt })
			.from(event)
			.where(inArray(event.id, eventIds));

		eventMap = Object.fromEntries(
			events.map((e) => [e.id, { title: e.title, startsAt: e.startsAt, endsAt: e.endsAt }])
		);
	}

	return tickets.map((t) => {
		const evt = eventMap[t.eventId];
		return {
			id: t.id,
			eventId: t.eventId,
			code: t.code,
			status: t.status,
			attendeeName: t.attendeeName,
			checkedInAt: t.checkedInAt ?? null,
			createdAt: t.createdAt,
			event: evt ?? null
		};
	});
});

export const getMemberEventDetail = query(z.string(), async (id) => {
	const { locals } = getRequestEvent();
	const evt = await getById(id);
	if (!evt) throw error(404, 'Event not found');
	const remaining = evt.ticketingEnabled ? await getTicketsRemaining(id) : null;
	const isSustainingMember = locals.user ? await hasAnyRole(locals.user.id, ['sustaining']) : false;

	// Sold is derived from remaining only when the event is both ticketed and capped;
	// otherwise the capacity bar isn't shown so the count isn't needed.
	const sold =
		evt.ticketQuantity != null && remaining != null ? evt.ticketQuantity - remaining : null;

	// Non-ticketed events use the lightweight RSVP join table for headcount.
	const rsvpCount = evt.ticketingEnabled ? 0 : await countRsvps(id);
	const myRsvp =
		!evt.ticketingEnabled && locals.user ? Boolean(await getUserRsvp(id, locals.user.id)) : false;

	// "More shows" tail: other upcoming events, excluding this one.
	const upcomingRows = await listUpcoming();
	const upcoming = upcomingRows
		.filter((e) => e.id !== id)
		.slice(0, 6)
		.map((e) => ({
			id: e.id,
			title: e.title,
			startsAt: e.startsAt,
			endsAt: e.endsAt,
			doorsAt: e.doorsAt ?? null,
			tags: e.tags as string | null,
			ticketingEnabled: e.ticketingEnabled,
			ticketPrice: e.ticketPrice,
			posterUrl: resolveImageUrl(e.posterKey)
		}));

	return {
		event: {
			id: evt.id,
			title: evt.title,
			description: evt.description,
			startsAt: evt.startsAt,
			endsAt: evt.endsAt,
			doorsAt: evt.doorsAt ?? null,
			location: evt.location,
			tags: evt.tags as string | null,
			posterUrl: resolveImageUrl(evt.posterKey),
			ticketingEnabled: evt.ticketingEnabled,
			ticketPrice: evt.ticketPrice,
			ticketQuantity: evt.ticketQuantity
		},
		remaining,
		sold,
		isSustainingMember,
		myRsvp,
		rsvpCount,
		upcoming
	};
});

export const getPublicEvents = query(async () => {
	const [upcoming, past] = await Promise.all([listUpcoming(), listPast(12)]);
	const mapEvent = (e: (typeof upcoming)[number]) => ({
		id: e.id,
		title: e.title,
		description: e.description,
		startsAt: e.startsAt,
		endsAt: e.endsAt,
		doorsAt: e.doorsAt ?? null,
		tags: e.tags as string | null,
		posterUrl: resolveImageUrl(e.posterKey),
		ticketingEnabled: e.ticketingEnabled,
		ticketPrice: e.ticketPrice
	});
	return { upcoming: upcoming.map(mapEvent), past: past.map(mapEvent) };
});

export const getPublicEventDetail = query(z.string(), async (id) => {
	const { locals } = getRequestEvent();
	const evt = await getById(id);
	if (!evt) throw error(404, 'Event not found');
	if (evt.status !== 'published') throw error(404, 'Event not found');

	const remaining = evt.ticketingEnabled ? await getTicketsRemaining(id) : null;
	const sold =
		evt.ticketQuantity != null && remaining != null ? evt.ticketQuantity - remaining : null;

	// Non-ticketed events use the lightweight RSVP join table for headcount.
	const rsvpCount = evt.ticketingEnabled ? 0 : await countRsvps(id);

	// Sustaining members see the discounted price; anonymous visitors don't.
	const isSustainingMember = locals.user ? await hasAnyRole(locals.user.id, ['sustaining']) : false;

	const isPast = evt.endsAt.getTime() < Date.now();

	// "More shows" tail: other upcoming events, excluding this one.
	const upcomingRows = await listUpcoming();
	const upcoming = upcomingRows
		.filter((e) => e.id !== id)
		.slice(0, 6)
		.map((e) => ({
			id: e.id,
			title: e.title,
			startsAt: e.startsAt,
			endsAt: e.endsAt,
			doorsAt: e.doorsAt ?? null,
			tags: e.tags as string | null,
			ticketingEnabled: e.ticketingEnabled,
			ticketPrice: e.ticketPrice,
			posterUrl: resolveImageUrl(e.posterKey)
		}));

	return {
		event: {
			id: evt.id,
			title: evt.title,
			description: evt.description,
			startsAt: evt.startsAt,
			endsAt: evt.endsAt,
			doorsAt: evt.doorsAt ?? null,
			location: evt.location,
			tags: evt.tags as string | null,
			posterUrl: resolveImageUrl(evt.posterKey),
			ticketingEnabled: evt.ticketingEnabled,
			ticketPrice: evt.ticketPrice,
			ticketQuantity: evt.ticketQuantity
		},
		remaining,
		sold,
		rsvpCount,
		isSustainingMember,
		isPast,
		isAuthenticated: !!locals.user,
		upcoming
	};
});

export const getPublicTicketPage = query(z.string(), async (id) => {
	const { locals } = getRequestEvent();
	const evt = await getById(id);
	if (!evt) throw error(404, 'Event not found');
	if (evt.status !== 'published') throw error(404, 'Event not found');
	if (!evt.ticketingEnabled) throw error(404, 'Tickets not available for this event');

	const remaining = await getTicketsRemaining(id);

	let isSustainingMember = false;
	if (locals.user?.stripeId) {
		const sub = await getSubscription(locals.user.stripeId);
		isSustainingMember = sub !== null;
	}

	const posterUrl = resolveImageUrl(evt.posterKey);

	return {
		event: {
			id: evt.id,
			title: evt.title,
			description: evt.description,
			startsAt: evt.startsAt,
			endsAt: evt.endsAt,
			doorsAt: evt.doorsAt ?? null,
			ticketPrice: evt.ticketPrice,
			ticketQuantity: evt.ticketQuantity
		},
		remaining,
		isSustainingMember,
		posterUrl,
		isAuthenticated: !!locals.user
	};
});

export const getTicketPurchaseSuccess = query(
	z.object({ eventId: z.string(), purchaseId: z.string() }),
	async ({ eventId, purchaseId }) => {
		const evt = await getById(eventId);
		if (!evt) throw error(404, 'Event not found');

		const tickets = await getTicketsByPurchase(purchaseId);
		if (tickets.length === 0) throw error(404, 'Purchase not found');

		return {
			event: {
				id: evt.id,
				title: evt.title,
				startsAt: evt.startsAt,
				endsAt: evt.endsAt,
				doorsAt: evt.doorsAt ?? null
			},
			tickets: tickets.map((t) => ({
				id: t.id,
				code: t.code,
				attendeeName: t.attendeeName,
				attendeeEmail: t.attendeeEmail,
				status: t.status
			}))
		};
	}
);

export const getStaffCheckIn = query(z.string(), async (id) => {
	await requireStaff();
	const evt = await getById(id);
	if (!evt) throw error(404, 'Event not found');
	if (!evt.ticketingEnabled) throw error(400, 'Ticketing not enabled for this event');

	const [tickets, sold] = await Promise.all([getEventTickets(id), getTicketsSold(id)]);

	const checkedIn = tickets.filter((t) => t.status === 'checked_in').length;

	return {
		event: {
			id: evt.id,
			title: evt.title,
			startsAt: evt.startsAt,
			ticketQuantity: evt.ticketQuantity
		},
		tickets: tickets
			.filter((t) => t.status === 'valid' || t.status === 'checked_in')
			.map((t) => ({
				id: t.id,
				attendeeName: t.attendeeName,
				attendeeEmail: t.attendeeEmail,
				code: t.code,
				status: t.status,
				checkedInAt: t.checkedInAt
			})),
		stats: { sold, checkedIn }
	};
});

export const getStaffEvents = query(z.object({ page: z.number().optional() }), async (filters) => {
	await requireStaff();
	return listAllEvents({ page: filters.page ?? 1, pageSize: 50 });
});

export const getStaffEventDetail = query(z.string(), async (id) => {
	await requireStaff();

	const evt = await getById(id);
	if (!evt) throw error(404, 'Event not found');

	const [creator] = await db
		.select({ name: user.name, email: user.email })
		.from(user)
		.where(eq(user.id, evt.createdByUserId))
		.limit(1);

	let linkedReservation: { id: string; status: string; startsAt: Date; endsAt: Date } | null = null;
	if (evt.reservationId) {
		const [res] = await db
			.select({
				id: reservation.id,
				status: reservation.status,
				startsAt: reservation.startsAt,
				endsAt: reservation.endsAt
			})
			.from(reservation)
			.where(eq(reservation.id, evt.reservationId))
			.limit(1);
		if (res) linkedReservation = res;
	}

	const posterUrl = resolveImageUrl(evt.posterKey);

	let ticketStats: { sold: number; remaining: number | null } | null = null;
	let tickets: {
		id: string;
		purchaseId: string | null;
		attendeeName: string;
		attendeeEmail: string;
		code: string;
		status: string;
		checkedInAt: Date | null;
		createdAt: Date;
	}[] = [];

	if (evt.ticketingEnabled) {
		const [sold, remaining, allTickets] = await Promise.all([
			getTicketsSold(evt.id),
			getTicketsRemaining(evt.id),
			getEventTickets(evt.id)
		]);
		ticketStats = { sold, remaining };
		tickets = allTickets.map((t) => ({
			id: t.id,
			purchaseId: t.purchaseId,
			attendeeName: t.attendeeName,
			attendeeEmail: t.attendeeEmail,
			code: t.code,
			status: t.status,
			checkedInAt: t.checkedInAt,
			createdAt: t.createdAt
		}));
	}

	return {
		event: {
			id: evt.id,
			title: evt.title,
			description: evt.description,
			startsAt: evt.startsAt,
			endsAt: evt.endsAt,
			doorsAt: evt.doorsAt,
			publishedAt: evt.publishedAt,
			createdAt: evt.createdAt,
			updatedAt: evt.updatedAt,
			status: evt.status,
			tags: evt.tags,
			reservationId: evt.reservationId,
			ticketingEnabled: evt.ticketingEnabled,
			ticketPrice: evt.ticketPrice,
			ticketQuantity: evt.ticketQuantity,
			posterKey: evt.posterKey
		},
		posterUrl,
		creator,
		linkedReservation,
		ticketStats,
		tickets
	};
});

export const checkConflicts = query(
	z.object({
		date: z.string(),
		startTime: z.string(),
		endTime: z.string(),
		excludeReservationId: z.string().optional()
	}),
	async ({ date, startTime, endTime, excludeReservationId }) => {
		await requireStaff();
		const startsAt = buildDateInTz(date, startTime, DEFAULT_TIMEZONE);
		const endsAt = buildDateInTz(date, endTime, DEFAULT_TIMEZONE);

		const conflicts = await getConflictDetails(startsAt, endsAt);
		const validationWarnings = await getValidationWarnings(startsAt, endsAt);

		// Filter out the event's own reservation from conflicts
		const filtered = excludeReservationId
			? conflicts.filter((c) => c.type !== 'reservation' || !('id' in c))
			: conflicts;

		return { conflicts: filtered, validationWarnings };
	}
);

export const checkRebook = query(
	z.object({
		eventId: z.string(),
		newStartsAt: z.string(),
		newEndsAt: z.string()
	}),
	async ({ eventId, newStartsAt, newEndsAt }) => {
		await requireStaff();
		const result = await checkRebookNeeded(eventId, new Date(newStartsAt), new Date(newEndsAt));
		return {
			needed: result.needed,
			reason: result.reason,
			currentReservation: result.currentReservation
				? {
						id: result.currentReservation.id,
						startsAt: result.currentReservation.startsAt,
						endsAt: result.currentReservation.endsAt
					}
				: null
		};
	}
);

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

export const createEvent = form(createEventSchema, async (data, issue) => {
	const staff = await requireStaff();

	const ticketingEnabled = data.ticketingEnabled;
	const reserveSpace = data.reserveSpace;
	const overrideConflicts = data.overrideConflicts;
	const ticketPrice = data.ticketPrice ? parseInt(data.ticketPrice, 10) : undefined;
	const ticketQuantity = data.ticketQuantity ? parseInt(data.ticketQuantity, 10) : undefined;

	if (!data.title) {
		issue.title('Title is required');
	}

	const tz = DEFAULT_TIMEZONE;
	const startsAt = buildDateInTz(data.eventDate, data.eventStartTime, tz);
	const endsAt = buildDateInTz(data.eventDate, data.eventEndTime, tz);
	const doorsAt = data.doorsTime ? buildDateInTz(data.eventDate, data.doorsTime, tz) : undefined;

	const reservation =
		reserveSpace && data.reservationStartTime && data.reservationEndTime
			? {
					startsAt: buildDateInTz(data.eventDate, data.reservationStartTime, tz),
					endsAt: buildDateInTz(data.eventDate, data.reservationEndTime, tz),
					overrideConflicts
				}
			: undefined;

	const event = await create({
		title: data.title,
		description: data.description || undefined,
		startsAt,
		endsAt,
		doorsAt,
		tags: data.tags || undefined,
		ticketingEnabled,
		ticketPrice: ticketingEnabled ? ticketPrice : undefined,
		ticketQuantity: ticketingEnabled ? ticketQuantity : undefined,
		createdByUserId: staff.id,
		reservation
	});

	return { eventId: event.id };
});

export const updateEvent = form(
	z.object({
		eventId: z.string().min(1),
		title: z.string().optional(),
		description: z.string().optional(),
		tags: z.string().optional(),
		eventDate: z.string().optional(),
		eventStartTime: z.string().optional(),
		eventEndTime: z.string().optional(),
		doorsTime: z.string().optional(),
		ticketingEnabled: z.boolean().optional(),
		ticketPrice: z.string().optional(),
		ticketQuantity: z.string().optional(),
		rebookReservation: z.boolean().default(false),
		reservationStartTime: z.string().optional(),
		reservationEndTime: z.string().optional(),
		overrideConflicts: z.boolean().default(false)
	}),
	async (data) => {
		const staff = await requireStaff();
		const tz = DEFAULT_TIMEZONE;

		const ticketingEnabled = data.ticketingEnabled;
		const rebookReservation = data.rebookReservation;
		const overrideConflicts = data.overrideConflicts;

		const updateParams: Parameters<typeof update>[1] = {};

		if (data.title !== undefined && data.title !== '') updateParams.title = data.title;
		if (data.description !== undefined) updateParams.description = data.description || null;
		if (data.tags !== undefined) updateParams.tags = data.tags || null;
		if (ticketingEnabled !== undefined) updateParams.ticketingEnabled = ticketingEnabled;
		if (data.ticketPrice !== undefined) {
			updateParams.ticketPrice = data.ticketPrice ? parseInt(data.ticketPrice, 10) : null;
		}
		if (data.ticketQuantity !== undefined) {
			updateParams.ticketQuantity = data.ticketQuantity ? parseInt(data.ticketQuantity, 10) : null;
		}

		// Build Date objects if date/time fields provided
		if (data.eventDate && data.eventStartTime && data.eventEndTime) {
			updateParams.startsAt = buildDateInTz(data.eventDate, data.eventStartTime, tz);
			updateParams.endsAt = buildDateInTz(data.eventDate, data.eventEndTime, tz);
		}

		if (data.doorsTime !== undefined) {
			updateParams.doorsAt =
				data.doorsTime && data.eventDate ? buildDateInTz(data.eventDate, data.doorsTime, tz) : null;
		}

		// Handle reservation rebooking
		if (
			rebookReservation &&
			data.eventDate &&
			data.reservationStartTime &&
			data.reservationEndTime
		) {
			updateParams.rebook = {
				userId: staff.id,
				reservationStartsAt: buildDateInTz(data.eventDate, data.reservationStartTime, tz),
				reservationEndsAt: buildDateInTz(data.eventDate, data.reservationEndTime, tz),
				overrideConflicts
			};
		}

		await update(data.eventId, updateParams);
		return { success: true };
	}
);

export const publishEvent = form(z.object({ id: z.string().min(1) }), async (data) => {
	await requireStaff();
	await publish(data.id);
	return { success: true };
});

export const unpublishEvent = form(z.object({ id: z.string().min(1) }), async (data) => {
	await requireStaff();
	await unpublish(data.id);
	return { success: true };
});

export const cancelEvent = form(z.object({ id: z.string().min(1) }), async (data) => {
	const staff = await requireStaff();
	await cancel(data.id, staff.id);
	return { success: true };
});

export const compTickets = form(
	z.object({
		eventId: z.string().min(1),
		attendeeName: z.string().min(1),
		attendeeEmail: z.string().min(1),
		quantity: z.string().transform(Number)
	}),
	async (data, issue) => {
		await requireStaff();

		if (!data.attendeeName) {
			issue.attendeeName('Name is required');
		}
		if (!data.attendeeEmail) {
			issue.attendeeEmail('Email is required');
		}
		if (isNaN(data.quantity) || data.quantity < 1 || data.quantity > 50) {
			issue.quantity('Quantity must be between 1 and 50');
		}

		const remaining = await getTicketsRemaining(data.eventId);
		if (remaining !== null && data.quantity > remaining) {
			throw error(400, `Only ${remaining} ticket(s) remaining`);
		}

		await createTickets({
			eventId: data.eventId,
			purchaseId: `comp-${crypto.randomUUID()}`,
			quantity: data.quantity,
			attendeeName: data.attendeeName,
			attendeeEmail: data.attendeeEmail,
			status: 'valid'
		});

		return { success: true };
	}
);

export const cancelTicket = form(
	z.object({
		ticketId: z.string().min(1)
	}),
	async (data) => {
		await requireStaff();
		await cancelTicketService(data.ticketId);
		return { success: true };
	}
);

export const checkInTicket = form(z.object({ ticketId: z.string().min(1) }), async (data) => {
	const staff = await requireStaff();
	await checkIn(data.ticketId, staff.id);
	return { success: true };
});

// Resolves the attendee's name and email for a ticket/RSVP form. Logged-in users don't
// have to re-type their details — their account values fill in any field left blank —
// while guests must still supply both. Reports validation through the form's `issue` API.
function resolveAttendee(
	data: { attendeeName?: string; attendeeEmail?: string },
	user: { name?: string | null; email?: string | null } | undefined,
	issue: { attendeeName: (msg: string) => void; attendeeEmail: (msg: string) => void }
): { name: string; email: string } {
	const name = (data.attendeeName ?? '').trim() || user?.name?.trim() || '';
	const email = (data.attendeeEmail ?? '').trim() || user?.email?.trim() || '';

	if (!name) issue.attendeeName('Name is required');
	if (!email) {
		issue.attendeeEmail('Email is required');
	} else if (!z.string().email().safeParse(email).success) {
		issue.attendeeEmail('Valid email is required');
	}

	return { name, email };
}

export const rsvpForEvent = form(
	z.object({
		eventId: z.string(),
		quantity: z.string().transform(Number),
		attendeeName: z.string().optional(),
		attendeeEmail: z.string().optional()
	}),
	async (data, issue) => {
		const { locals } = getRequestEvent();

		if (isNaN(data.quantity) || data.quantity < 1 || data.quantity > 10) {
			issue.quantity('Quantity must be between 1 and 10');
		}

		// Logged-in attendees needn't re-enter their details; fall back to their account.
		const attendee = resolveAttendee(data, locals.user, issue);

		const evt = await getById(data.eventId);
		if (!evt) throw error(404, 'Event not found');
		if (evt.status !== 'published') throw error(400, 'Event is not published');
		if (!evt.ticketingEnabled) throw error(400, 'RSVPs not available');
		if (evt.ticketPrice && evt.ticketPrice > 0) throw error(400, 'This is a paid event');

		const remaining = await getTicketsRemaining(data.eventId);
		if (remaining !== null && data.quantity > remaining) {
			throw error(
				400,
				remaining === 0 ? 'This event is full' : `Only ${remaining} spots remaining`
			);
		}

		const purchaseId = `rsvp-${randomUUID()}`;

		await createTickets({
			eventId: evt.id,
			purchaseId,
			quantity: data.quantity,
			userId: locals.user?.id ?? undefined,
			attendeeName: attendee.name,
			attendeeEmail: attendee.email,
			status: 'valid'
		});

		return { redirectUrl: `/events/${evt.id}/tickets/success?purchase_id=${purchaseId}` };
	}
);

// RSVP for a NON-ticketed event. Distinct from `rsvpForEvent` above (which issues a free
// *ticket* with a QR code for price-0 ticketed events): this writes a lightweight join
// row with no code, no check-in, and no capacity. One RSVP per member (idempotent).
export const rsvpToEvent = form(
	z.object({
		eventId: z.string(),
		attendeeName: z.string().min(1, 'Name is required'),
		attendeeEmail: z.string().email('Valid email is required')
	}),
	async (data) => {
		const user = requireUser();

		const evt = await getById(data.eventId);
		if (!evt) throw error(404, 'Event not found');
		if (evt.status !== 'published') throw error(400, 'Event is not published');
		if (evt.ticketingEnabled) throw error(400, 'This event uses tickets, not RSVPs');

		await createRsvp({
			eventId: evt.id,
			userId: user.id,
			attendeeName: data.attendeeName,
			attendeeEmail: data.attendeeEmail
		});

		return { success: true };
	}
);

export const cancelRsvp = form(z.object({ eventId: z.string() }), async (data) => {
	const user = requireUser();
	await cancelRsvpService(data.eventId, user.id);
	return { success: true };
});

export const purchaseTickets = form(
	z.object({
		eventId: z.string(),
		quantity: z.string().transform(Number),
		attendeeName: z.string().optional(),
		attendeeEmail: z.string().optional(),
		coverFees: z.boolean().default(false)
	}),
	async (data, issue) => {
		const { locals, url } = getRequestEvent();

		if (isNaN(data.quantity) || data.quantity < 1 || data.quantity > 10) {
			issue.quantity('Quantity must be between 1 and 10');
		}

		// Logged-in buyers needn't re-enter their details; fall back to their account.
		const attendee = resolveAttendee(data, locals.user, issue);

		const evt = await getById(data.eventId);
		if (!evt) throw error(404, 'Event not found');
		if (evt.status !== 'published') throw error(400, 'Event is not published');
		if (!evt.ticketingEnabled || !evt.ticketPrice) throw error(400, 'Tickets not available');

		const remaining = await getTicketsRemaining(data.eventId);
		if (remaining !== null && data.quantity > remaining) {
			throw error(
				400,
				remaining === 0 ? 'This event is sold out' : `Only ${remaining} tickets remaining`
			);
		}

		const coverFees = data.coverFees;
		const purchaseId = randomUUID();

		await createTickets({
			eventId: evt.id,
			purchaseId,
			quantity: data.quantity,
			userId: locals.user?.id ?? undefined,
			attendeeName: attendee.name,
			attendeeEmail: attendee.email,
			status: 'pending'
		});

		let unitPrice = evt.ticketPrice;
		if (locals.user?.stripeId) {
			const sub = await getSubscription(locals.user.stripeId);
			if (sub) {
				unitPrice = Math.round(unitPrice / 2);
			}
		}

		const lineItem = await buildLineItem('ticket', unitPrice, data.quantity);

		const result = await checkout({
			stripeCustomerId: locals.user?.stripeId ?? undefined,
			customerEmail: locals.user?.email ?? attendee.email,
			userId: locals.user?.id ?? undefined,
			mode: 'payment',
			lineItems: [lineItem],
			coverFees,
			metadata: {
				type: 'ticket',
				purchase_id: purchaseId,
				event_id: evt.id,
				ticket_quantity: String(data.quantity)
			},
			successUrl: `${url.origin}/events/${evt.id}/tickets/success?purchase_id=${purchaseId}`,
			cancelUrl: `${url.origin}/events/${evt.id}/tickets`
		});

		if (result.paid) {
			const { fulfillPurchase } = await import('$lib/server/ticket/ticket-service');
			await fulfillPurchase(purchaseId);
			return { redirectUrl: `/events/${evt.id}/tickets/success?purchase_id=${purchaseId}` };
		}

		return { redirectUrl: result.checkoutUrl! };
	}
);
