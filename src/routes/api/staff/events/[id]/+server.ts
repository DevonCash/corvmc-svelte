import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasAnyRole } from '$lib/server/authorization';
import { getById } from '$lib/server/event/event-service';
import { getPublicUrl, isConfigured } from '$lib/server/storage';
import {
	getEventTickets,
	getTicketsSold,
	getTicketsRemaining
} from '$lib/server/ticket/ticket-service';
import { db } from '$lib/server/db';
import { reservation } from '$lib/server/db/schema/reservation';
import { user } from '$lib/server/db/schema/authentication';
import { eq } from 'drizzle-orm';
import type { EventStatus } from '$lib/server/db/schema/event';
import type { StaffEventDetailResponse } from '$lib/server/db/schema/api';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) return error(401, 'Not authenticated');
	const allowed = await hasAnyRole(locals.user.id, ['admin', 'staff']);
	if (!allowed) return error(403, 'Staff access required');

	const evt = await getById(params.id);
	if (!evt) return error(404, 'Event not found');

	// Load creator info
	const [creator] = await db
		.select({ name: user.name, email: user.email })
		.from(user)
		.where(eq(user.id, evt.createdByUserId))
		.limit(1);

	// Load linked reservation details if present
	let linkedReservation: StaffEventDetailResponse['linkedReservation'] = null;

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

		if (res) {
			linkedReservation = {
				id: res.id,
				status: res.status,
				startsAt: res.startsAt,
				endsAt: res.endsAt
			};
		}
	}

	// Build poster URL
	let posterUrl: string | null = null;
	if (evt.posterKey && isConfigured()) {
		posterUrl = getPublicUrl(evt.posterKey);
	}

	// Load ticket data if ticketing is enabled
	let ticketStats: StaffEventDetailResponse['ticketStats'] = null;
	let tickets: StaffEventDetailResponse['tickets'] = [];

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

	return json({
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
			status: evt.status as EventStatus,
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
	});
};
