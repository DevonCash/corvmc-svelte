import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getById } from '$lib/server/event/event-service';
import { getEventTickets, getTicketsSold } from '$lib/server/ticket/ticket-service';

export const load: PageServerLoad = async ({ params }) => {
	const evt = await getById(params.id);
	if (!evt) throw error(404, 'Event not found');
	if (!evt.ticketingEnabled) throw error(400, 'Ticketing not enabled for this event');

	const [tickets, sold] = await Promise.all([
		getEventTickets(params.id),
		getTicketsSold(params.id)
	]);

	const checkedIn = tickets.filter((t) => t.status === 'checked_in').length;

	return {
		event: {
			id: evt.id,
			title: evt.title,
			startsAt: evt.startsAt.toISOString(),
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
				checkedInAt: t.checkedInAt?.toISOString() ?? null
			})),
		stats: { sold, checkedIn }
	};
};
