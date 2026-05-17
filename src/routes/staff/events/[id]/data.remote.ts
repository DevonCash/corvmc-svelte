import { z } from 'zod';
import { command, query } from '$app/server';
import { requireStaff } from '$lib/server/authorization';
import {
	publish,
	unpublish,
	cancel,
	update,
	checkRebookNeeded
} from '$lib/server/event/event-service';
import { createTickets, getTicketsRemaining } from '$lib/server/ticket/ticket-service';
import { getConflictDetails, getValidationWarnings } from '$lib/server/reservation/conflict-service';
import { buildDateInTz } from '$lib/server/reservation/timezone';

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
		const validationWarnings = getValidationWarnings(startsAt, endsAt);

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
// Commands
// ---------------------------------------------------------------------------

export const publishEvent = command(
	z.object({ eventId: z.string().min(1) }),
	async (data) => {
		await requireStaff();
		await publish(data.eventId);
		return { success: true };
	}
);

export const unpublishEvent = command(
	z.object({ eventId: z.string().min(1) }),
	async (data) => {
		await requireStaff();
		await unpublish(data.eventId);
		return { success: true };
	}
);

export const cancelEvent = command(
	z.object({ eventId: z.string().min(1) }),
	async (data) => {
		const staff = await requireStaff();
		await cancel(data.eventId, staff.id);
		return { success: true };
	}
);

export const compTickets = command(
	z.object({
		eventId: z.string().min(1),
		attendeeName: z.string().min(1).max(255),
		attendeeEmail: z.string().email(),
		quantity: z.number().int().min(1).max(50)
	}),
	async (data) => {
		await requireStaff();
		const remaining = await getTicketsRemaining(data.eventId);
		if (remaining !== null && data.quantity > remaining) {
			throw new Error(`Only ${remaining} ticket(s) remaining`);
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

const updateEventSchema = z.object({
	eventId: z.string().min(1),
	title: z.string().min(1).optional(),
	description: z.string().nullable().optional(),
	tags: z.string().nullable().optional(),
	eventDate: z.string().optional(),
	eventStartTime: z.string().optional(),
	eventEndTime: z.string().optional(),
	doorsTime: z.string().nullable().optional(),
	// Ticketing
	ticketingEnabled: z.boolean().optional(),
	ticketPrice: z.number().int().positive().nullable().optional(),
	ticketQuantity: z.number().int().positive().nullable().optional(),
	// Rebook params — only sent when user confirmed the rebook
	rebookReservation: z.boolean().default(false),
	reservationStartTime: z.string().optional(),
	reservationEndTime: z.string().optional(),
	overrideConflicts: z.boolean().default(false)
});

export const updateEvent = command(updateEventSchema, async (raw) => {
	const staff = await requireStaff();
	const data = raw as z.infer<typeof updateEventSchema>;
	const { eventId, ...fields } = data;
	const tz = 'America/Los_Angeles';

	const updateParams: Parameters<typeof update>[1] = {};

	if (fields.title !== undefined) updateParams.title = fields.title;
	if (fields.description !== undefined) updateParams.description = fields.description;
	if (fields.tags !== undefined) updateParams.tags = fields.tags;
	if (fields.ticketingEnabled !== undefined) updateParams.ticketingEnabled = fields.ticketingEnabled;
	if (fields.ticketPrice !== undefined) updateParams.ticketPrice = fields.ticketPrice;
	if (fields.ticketQuantity !== undefined) updateParams.ticketQuantity = fields.ticketQuantity;

	// Build Date objects if date/time fields provided
	if (fields.eventDate && fields.eventStartTime && fields.eventEndTime) {
		updateParams.startsAt = buildDateInTz(fields.eventDate, fields.eventStartTime, tz);
		updateParams.endsAt = buildDateInTz(fields.eventDate, fields.eventEndTime, tz);
	}

	if (fields.doorsTime !== undefined) {
		updateParams.doorsAt = fields.doorsTime && fields.eventDate
			? buildDateInTz(fields.eventDate, fields.doorsTime, tz)
			: null;
	}

	// Handle reservation rebooking
	if (fields.rebookReservation && fields.eventDate && fields.reservationStartTime && fields.reservationEndTime) {
		updateParams.rebook = {
			userId: staff.id,
			reservationStartsAt: buildDateInTz(fields.eventDate, fields.reservationStartTime, tz),
			reservationEndsAt: buildDateInTz(fields.eventDate, fields.reservationEndTime, tz),
			overrideConflicts: fields.overrideConflicts
		};
	}

	await update(eventId, updateParams);
	return { success: true };
});
