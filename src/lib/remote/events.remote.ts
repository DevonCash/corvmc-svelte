import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { query, form, getRequestEvent } from '$app/server';
import { requireStaff } from '$lib/server/authorization';
import { create, update, checkRebookNeeded, publish, unpublish, cancel, getById } from '$lib/server/event/event-service';
import { getConflictDetails, getValidationWarnings } from '$lib/server/reservation/conflict-service';
import { buildDateInTz } from '$lib/server/reservation/timezone';
import { getTicketsRemaining, createTickets, checkIn, cancelTicket as cancelTicketService } from '$lib/server/ticket/ticket-service';
import { getSubscription } from '$lib/server/finance/subscription-service';
import { checkout } from '$lib/server/finance/payment-service';
import { buildLineItem } from '$lib/server/finance/product-config-service';
import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const checkConflicts = query(
	z.object({
		date: z.string(),
		startTime: z.string(),
		endTime: z.string(),
		excludeReservationId: z.string().optional()
	}),
	async ({ date, startTime, endTime, excludeReservationId }) => {
		await requireStaff();
		const startsAt = buildDateInTz(date, startTime, 'America/Los_Angeles');
		const endsAt = buildDateInTz(date, endTime, 'America/Los_Angeles');

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
		const result = await checkRebookNeeded(
			eventId,
			new Date(newStartsAt),
			new Date(newEndsAt)
		);
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

export const createEvent = form(
	z.object({
		title: z.string().min(1, 'Title is required'),
		description: z.string().optional(),
		eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
		eventStartTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time'),
		eventEndTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time'),
		doorsTime: z.string().optional(),
		tags: z.string().optional(),
		ticketingEnabled: z.string().optional(),
		ticketPrice: z.string().optional(),
		ticketQuantity: z.string().optional(),
		reserveSpace: z.string().optional(),
		reservationStartTime: z.string().optional(),
		reservationEndTime: z.string().optional(),
		overrideConflicts: z.string().optional()
	}),
	async (data, issue) => {
		const staff = await requireStaff();

		const ticketingEnabled = data.ticketingEnabled === 'on';
		const reserveSpace = data.reserveSpace === 'on';
		const overrideConflicts = data.overrideConflicts === 'on';
		const ticketPrice = data.ticketPrice ? parseInt(data.ticketPrice, 10) : undefined;
		const ticketQuantity = data.ticketQuantity ? parseInt(data.ticketQuantity, 10) : undefined;

		if (!data.title) {
			issue.title('Title is required');
		}

		const tz = 'America/Los_Angeles';
		const startsAt = buildDateInTz(data.eventDate, data.eventStartTime, tz);
		const endsAt = buildDateInTz(data.eventDate, data.eventEndTime, tz);
		const doorsAt = data.doorsTime ? buildDateInTz(data.eventDate, data.doorsTime, tz) : undefined;

		const reservation = reserveSpace && data.reservationStartTime && data.reservationEndTime
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
	}
);

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
		ticketingEnabled: z.string().optional(),
		ticketPrice: z.string().optional(),
		ticketQuantity: z.string().optional(),
		rebookReservation: z.string().optional(),
		reservationStartTime: z.string().optional(),
		reservationEndTime: z.string().optional(),
		overrideConflicts: z.string().optional()
	}),
	async (data) => {
		const staff = await requireStaff();
		const tz = 'America/Los_Angeles';

		const ticketingEnabled = data.ticketingEnabled === 'on' ? true : data.ticketingEnabled === 'off' ? false : undefined;
		const rebookReservation = data.rebookReservation === 'on';
		const overrideConflicts = data.overrideConflicts === 'on';

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
			updateParams.doorsAt = data.doorsTime && data.eventDate
				? buildDateInTz(data.eventDate, data.doorsTime, tz)
				: null;
		}

		// Handle reservation rebooking
		if (rebookReservation && data.eventDate && data.reservationStartTime && data.reservationEndTime) {
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

export const publishEvent = form(
	z.object({ id: z.string().min(1) }),
	async (data) => {
		await requireStaff();
		await publish(data.id);
		return { success: true };
	}
);

export const unpublishEvent = form(
	z.object({ id: z.string().min(1) }),
	async (data) => {
		await requireStaff();
		await unpublish(data.id);
		return { success: true };
	}
);

export const cancelEvent = form(
	z.object({ id: z.string().min(1) }),
	async (data) => {
		const staff = await requireStaff();
		await cancel(data.id, staff.id);
		return { success: true };
	}
);

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

export const checkInTicket = form(
	z.object({ ticketId: z.string().min(1) }),
	async (data) => {
		const staff = await requireStaff();
		await checkIn(data.ticketId, staff.id);
		return { success: true };
	}
);

export const purchaseTickets = form(
	z.object({
		eventId: z.string(),
		quantity: z.string().transform(Number),
		attendeeName: z.string().min(1),
		attendeeEmail: z.string().email(),
		coverFees: z.string().optional()
	}),
	async (data, issue) => {
		const { locals, url } = getRequestEvent();

		if (isNaN(data.quantity) || data.quantity < 1 || data.quantity > 10) {
			issue.quantity('Quantity must be between 1 and 10');
		}

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

		const coverFees = data.coverFees === 'on';
		const purchaseId = randomUUID();

		await createTickets({
			eventId: evt.id,
			purchaseId,
			quantity: data.quantity,
			userId: locals.user?.id ?? undefined,
			attendeeName: data.attendeeName,
			attendeeEmail: data.attendeeEmail,
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
			customerEmail: locals.user?.email ?? data.attendeeEmail,
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
