import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasAnyRole } from '$lib/server/authorization';
import { getById } from '$lib/server/event/event-service';
import { getEventTickets, getTicketsSold } from '$lib/server/ticket/ticket-service';
import type { StaffCheckInResponse } from '$lib/server/db/schema/api';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) return error(401, 'Not authenticated');
	const allowed = await hasAnyRole(locals.user.id, ['admin', 'staff']);
	if (!allowed) return error(403, 'Staff access required');

	const evt = await getById(params.id);
	if (!evt) return error(404, 'Event not found');
	if (!evt.ticketingEnabled) return error(400, 'Ticketing not enabled for this event');

	const [tickets, sold] = await Promise.all([
		getEventTickets(params.id),
		getTicketsSold(params.id)
	]);

	const checkedIn = tickets.filter((t) => t.status === 'checked_in').length;

	return json({
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
	});
};
