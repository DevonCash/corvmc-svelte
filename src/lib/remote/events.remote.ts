import { z } from 'zod';
import { error, invalid } from '@sveltejs/kit';
import { query, form, getRequestEvent } from '$app/server';
import { requireStaff, requireUser } from '$lib/server/authorization';
import {
	create,
	update,
	checkRebookNeeded,
	publish,
	unpublishWithBandNotice,
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
import { buildDateInTz, buildTimeRangeInTz } from '$lib/server/reservation/timezone';
import {
	createEventSeries,
	getByEvent,
	getEventSeries,
	cancel as cancelSeries
} from '$lib/server/reservation/recurring-series-service';
import { buildRRule, getOccurrences } from '$lib/server/reservation/rrule-helpers';
import { RECURRING_FREQUENCIES, type RecurringFrequency } from '$lib/server/db/schema/recurring';
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
import { isSustainingMember as checkSustainingMember } from '$lib/server/finance/subscription-service';
import { checkout } from '$lib/server/finance/payment-service';
import { buildLineItem } from '$lib/server/finance/product-config-service';
import { resolveImageUrl } from '$lib/server/storage';
import { db } from '$lib/server/db';
import { reservation } from '$lib/server/db/schema/reservation';
import { user } from '$lib/server/db/schema/authentication';
import { eq, inArray } from 'drizzle-orm';
import { event, createEventSchema, eventSources } from '$lib/server/db/schema/event';
import { band } from '$lib/server/db/schema/band';
import { isFeatureEnabled } from '$lib/server/feature-flags';
import { randomUUID } from 'crypto';
import { DEFAULT_TIMEZONE } from '$lib/config';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Deliberately unguarded despite the name: returns only the same public event
 * fields the public listing shows (no attendee, ticket or purchaser data).
 */
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
	const isSustainingMember = locals.user ? await checkSustainingMember(locals.user.id) : false;

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

/** Next few CMC shows as poster cards — the /events hero and home-page section. */
export const getPublicEvents = query(async () => {
	const upcoming = await listUpcoming(3);
	return {
		upcoming: upcoming.map((e) => ({
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
		}))
	};
});

export const getPublicEventDetail = query(z.string(), async (id) => {
	const { locals } = getRequestEvent();
	const evt = await getById(id);
	if (!evt) throw error(404, 'Event not found');
	if (evt.status !== 'published') throw error(404, 'Event not found');

	// Band events are public only while the bandEvents feature is on, matching
	// the gate on the band listing queries.
	if (evt.source === 'band' && !(await isFeatureEnabled('bandEvents'))) {
		throw error(404, 'Event not found');
	}

	let bandInfo: { name: string; slug: string } | null = null;
	if (evt.bandId) {
		const [row] = await db
			.select({ name: band.name, slug: band.slug })
			.from(band)
			.where(eq(band.id, evt.bandId))
			.limit(1);
		bandInfo = row ?? null;
	}

	const remaining = evt.ticketingEnabled ? await getTicketsRemaining(id) : null;
	const sold =
		evt.ticketQuantity != null && remaining != null ? evt.ticketQuantity - remaining : null;

	// Non-ticketed events use the lightweight RSVP join table for headcount.
	const rsvpCount = evt.ticketingEnabled ? 0 : await countRsvps(id);

	// Sustaining members see the discounted price; anonymous visitors don't.
	const isSustainingMember = locals.user ? await checkSustainingMember(locals.user.id) : false;

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
			ticketQuantity: evt.ticketQuantity,
			source: evt.source,
			externalTicketUrl: evt.externalTicketUrl,
			bandName: bandInfo?.name ?? null,
			bandSlug: bandInfo?.slug ?? null
		},
		remaining,
		sold,
		rsvpCount,
		isSustainingMember,
		isPast,
		isAuthenticated: !!locals.user,
		canReport: await isFeatureEnabled('contentFlags'),
		upcoming
	};
});

export const getPublicTicketPage = query(z.string(), async (id) => {
	const { locals } = getRequestEvent();
	const evt = await getById(id);
	if (!evt) throw error(404, 'Event not found');
	if (evt.status !== 'published') throw error(404, 'Event not found');
	if (!evt.ticketingEnabled) throw error(404, 'Tickets not available for this event');
	// Band gigs are never sold through CMC (see `update()` in event-service).
	// Checked on source rather than the bandEvents flag so a row that predates
	// that rule — or one written around it — still cannot reach checkout.
	if (evt.source === 'band') throw error(404, 'Tickets not available for this event');

	const remaining = await getTicketsRemaining(id);

	// DB snapshot is the single membership source (matches the purchase path).
	const isSustainingMember = locals.user ? await checkSustainingMember(locals.user.id) : false;

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

/**
 * Deliberately unguarded: the post-checkout success page must work for guest
 * buyers who have no account. `purchaseId` is a randomUUID minted at checkout,
 * so it acts as an unguessable capability token for that one purchase. Do not
 * widen this to accept an enumerable id (event id, email, ticket code).
 */
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

export const getStaffEvents = query(
	z.object({ source: z.enum(eventSources).optional(), page: z.number().optional() }),
	async (filters) => {
		await requireStaff();
		return listAllEvents({ source: filters.source }, { page: filters.page ?? 1, pageSize: 50 });
	}
);

export const getStaffEventDetail = query(z.string(), async (id) => {
	await requireStaff();

	const evt = await getById(id);
	if (!evt) throw error(404, 'Event not found');

	const [creator] = await db
		.select({ name: user.name, email: user.email })
		.from(user)
		.where(eq(user.id, evt.createdByUserId))
		.limit(1);

	// Band attribution: staff need to see whose gig this is before editing or
	// pulling it, since band events sit in the same list as CMC ones.
	let bookingBand: { id: string; name: string; slug: string } | null = null;
	if (evt.bandId) {
		const [row] = await db
			.select({ id: band.id, name: band.name, slug: band.slug })
			.from(band)
			.where(eq(band.id, evt.bandId))
			.limit(1);
		if (row) bookingBand = row;
	}

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
			posterKey: evt.posterKey,
			source: evt.source,
			bandId: evt.bandId,
			location: evt.location,
			externalTicketUrl: evt.externalTicketUrl
		},
		band: bookingBand,
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
		const { startsAt, endsAt } = buildTimeRangeInTz(date, startTime, endTime, DEFAULT_TIMEZONE);

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
		invalid(issue.title('Title is required'));
	}

	const tz = DEFAULT_TIMEZONE;
	// One date field covers both times, so an end before the start means the show
	// runs past midnight and the range rolls onto the next day.
	const { startsAt, endsAt } = buildTimeRangeInTz(
		data.eventDate,
		data.eventStartTime,
		data.eventEndTime,
		tz
	);
	const doorsAt = data.doorsTime ? buildDateInTz(data.eventDate, data.doorsTime, tz) : undefined;

	const reservation =
		reserveSpace && data.reservationStartTime && data.reservationEndTime
			? {
					...buildTimeRangeInTz(
						data.eventDate,
						data.reservationStartTime,
						data.reservationEndTime,
						tz
					),
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

	// Recurring: register a series so the generation job materializes occurrences.
	if (data.recurring && data.recurringFrequency) {
		await createEventSeries({
			prototypeEventId: event.id,
			frequency: data.recurringFrequency as RecurringFrequency,
			prototypeStartsAt: startsAt,
			monthlyMode: data.monthlyMode,
			endsAt: data.recurringEndsAt ? buildDateInTz(data.recurringEndsAt, '23:59', tz) : undefined
		});
	}

	return { eventId: event.id };
});

/** Preview the next handful of occurrences for a recurring event series. */
export const previewRecurringEvents = query(
	z.object({
		date: z.string(),
		startTime: z.string(),
		frequency: z.enum(RECURRING_FREQUENCIES),
		monthlyMode: z.enum(['weekday', 'monthday']).optional()
	}),
	async ({ date, startTime, frequency, monthlyMode }) => {
		const startsAt = buildDateInTz(date, startTime, DEFAULT_TIMEZONE);
		const rruleString = buildRRule(startsAt, frequency, monthlyMode ?? 'weekday');
		const now = new Date();
		const windowEnd = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
		const occurrences = getOccurrences(rruleString, now, windowEnd);
		return {
			dates: occurrences.slice(0, 8).map((d) => d.toISOString()),
			totalInWindow: occurrences.length
		};
	}
);

/** The recurring series an event belongs to, if any (staff). */
export const getEventRecurringSeries = query(z.string(), async (eventId) => {
	await requireStaff();
	const series = await getByEvent(eventId);
	if (!series) return null;
	return getEventSeries(series.id);
});

/** Stop a recurring event series; existing occurrences remain (staff). */
export const cancelEventSeries = form(z.object({ seriesId: z.string() }), async (data) => {
	await requireStaff();
	await cancelSeries(data.seriesId);
	return { success: true };
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
		// Band gigs live off these two — without them staff can see a wrong venue
		// or a dead ticket link on the guide and have no way to fix it.
		location: z.string().max(255).optional(),
		externalTicketUrl: z.string().max(500).optional(),
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
		if (data.location !== undefined) updateParams.location = data.location || null;
		if (data.externalTicketUrl !== undefined) {
			updateParams.externalTicketUrl = data.externalTicketUrl || null;
		}
		if (ticketingEnabled !== undefined) updateParams.ticketingEnabled = ticketingEnabled;
		if (data.ticketPrice !== undefined) {
			updateParams.ticketPrice = data.ticketPrice ? parseInt(data.ticketPrice, 10) : null;
		}
		if (data.ticketQuantity !== undefined) {
			updateParams.ticketQuantity = data.ticketQuantity ? parseInt(data.ticketQuantity, 10) : null;
		}

		// Build Date objects if date/time fields provided. One date field covers both
		// times, so an end before the start means the show runs past midnight and the
		// range rolls onto the next day.
		if (data.eventDate && data.eventStartTime && data.eventEndTime) {
			const range = buildTimeRangeInTz(data.eventDate, data.eventStartTime, data.eventEndTime, tz);
			updateParams.startsAt = range.startsAt;
			updateParams.endsAt = range.endsAt;
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
			const reservationRange = buildTimeRangeInTz(
				data.eventDate,
				data.reservationStartTime,
				data.reservationEndTime,
				tz
			);
			updateParams.rebook = {
				userId: staff.id,
				reservationStartsAt: reservationRange.startsAt,
				reservationEndsAt: reservationRange.endsAt,
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
	// Band-sourced events notify the band's admins — pulling a gig silently is
	// the one unpublish that needs a word back to whoever posted it.
	await unpublishWithBandNotice(data.id);
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

		const issues: Parameters<typeof invalid> = [];
		if (!data.attendeeName) {
			issues.push(issue.attendeeName('Name is required'));
		}
		if (!data.attendeeEmail) {
			issues.push(issue.attendeeEmail('Email is required'));
		}
		if (isNaN(data.quantity) || data.quantity < 1 || data.quantity > 50) {
			issues.push(issue.quantity('Quantity must be between 1 and 50'));
		}
		if (issues.length) invalid(...issues);

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

// A single field issue as constructed by a form handler's `issue` helper. Note that
// constructing one does nothing on its own — it only takes effect when handed to
// `invalid()`, which throws.
type FormIssue = Parameters<typeof invalid>[number];

// Resolves the attendee's name and email for a ticket/RSVP form. Logged-in users don't
// have to re-type their details — their account values fill in any field left blank —
// while guests must still supply both. Returns any validation issues rather than
// throwing, so the caller can report them alongside its own (e.g. quantity) in one pass.
function resolveAttendee(
	data: { attendeeName?: string; attendeeEmail?: string },
	user: { name?: string | null; email?: string | null } | undefined,
	issue: {
		attendeeName: (msg: string) => FormIssue;
		attendeeEmail: (msg: string) => FormIssue;
	}
): { name: string; email: string; issues: FormIssue[] } {
	const name = (data.attendeeName ?? '').trim() || user?.name?.trim() || '';
	const email = (data.attendeeEmail ?? '').trim() || user?.email?.trim() || '';

	const issues: FormIssue[] = [];
	if (!name) issues.push(issue.attendeeName('Name is required'));
	if (!email) {
		issues.push(issue.attendeeEmail('Email is required'));
	} else if (!z.string().email().safeParse(email).success) {
		issues.push(issue.attendeeEmail('Valid email is required'));
	}

	return { name, email, issues };
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

		const issues: FormIssue[] = [];
		if (isNaN(data.quantity) || data.quantity < 1 || data.quantity > 10) {
			issues.push(issue.quantity('Quantity must be between 1 and 10'));
		}

		// Logged-in attendees needn't re-enter their details; fall back to their account.
		const attendee = resolveAttendee(data, locals.user, issue);
		issues.push(...attendee.issues);
		if (issues.length) invalid(...issues);

		const evt = await getById(data.eventId);
		if (!evt) throw error(404, 'Event not found');
		if (evt.status !== 'published') throw error(400, 'Event is not published');
		if (!evt.ticketingEnabled) throw error(400, 'RSVPs not available');
		if (evt.ticketPrice && evt.ticketPrice > 0) throw error(400, 'This is a paid event');
		// Issues a real ticket row, so it falls under the same rule as a paid
		// purchase: a band gig is not ticketed through CMC at any price.
		if (evt.source === 'band') throw error(400, 'RSVPs not available');

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
		// The detail page never offers RSVP on a band gig — it is the venue's show
		// to run. Enforced here too so the rule does not live only in the markup.
		if (evt.source === 'band') throw error(400, 'RSVPs not available');

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

		const issues: FormIssue[] = [];
		if (isNaN(data.quantity) || data.quantity < 1 || data.quantity > 10) {
			issues.push(issue.quantity('Quantity must be between 1 and 10'));
		}

		// Logged-in buyers needn't re-enter their details; fall back to their account.
		const attendee = resolveAttendee(data, locals.user, issue);
		issues.push(...attendee.issues);
		if (issues.length) invalid(...issues);

		const evt = await getById(data.eventId);
		if (!evt) throw error(404, 'Event not found');
		if (evt.status !== 'published') throw error(400, 'Event is not published');
		if (!evt.ticketingEnabled || !evt.ticketPrice) throw error(400, 'Tickets not available');
		// Mirrors getPublicTicketPage. This is the endpoint that actually takes
		// money, so it repeats the check rather than trusting the page guard.
		if (evt.source === 'band') throw error(400, 'Tickets not available');

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

		// Member discount keyed off the DB subscription snapshot — the same source
		// every other flow uses (a live Stripe read can disagree after webhook lag
		// or past_due, showing one price and charging another).
		let unitPrice = evt.ticketPrice;
		if (locals.user && (await checkSustainingMember(locals.user.id))) {
			unitPrice = Math.round(unitPrice / 2);
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
				ticket_quantity: String(data.quantity),
				// The webhook needs this to break the charge into tickets vs. covered
				// fees on the receipt — the session alone can't tell them apart.
				ticket_unit_price_cents: String(unitPrice)
			},
			successUrl: `${url.origin}/events/${evt.id}/tickets/success?purchase_id=${purchaseId}`,
			cancelUrl: `${url.origin}/events/${evt.id}/tickets`
		});

		if (result.paid) {
			const { fulfillPurchase } = await import('$lib/server/ticket/ticket-service');
			// Credits covered the whole cart — checkout() still records a Stripe
			// payment record for it, so the tickets store that as their proof of
			// payment just like a card purchase does.
			await fulfillPurchase(purchaseId, result.stripePaymentRecordId);
			return { redirectUrl: `/events/${evt.id}/tickets/success?purchase_id=${purchaseId}` };
		}

		return { redirectUrl: result.checkoutUrl! };
	}
);
