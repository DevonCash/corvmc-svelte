import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getById } from '$lib/server/event/event-service';
import { getTicketsByPurchase } from '$lib/server/ticket/ticket-service';

export const load: PageServerLoad = async ({ params, url }) => {
	const purchaseId = url.searchParams.get('purchase_id');
	if (!purchaseId) throw error(400, 'Missing purchase ID');

	const evt = await getById(params.id);
	if (!evt) throw error(404, 'Event not found');

	const tickets = await getTicketsByPurchase(purchaseId);
	if (tickets.length === 0) throw error(404, 'Purchase not found');

	return {
		event: {
			id: evt.id,
			title: evt.title,
			startsAt: evt.startsAt.toISOString(),
			endsAt: evt.endsAt.toISOString(),
			doorsAt: evt.doorsAt?.toISOString() ?? null
		},
		tickets: tickets.map((t) => ({
			id: t.id,
			code: t.code,
			attendeeName: t.attendeeName,
			attendeeEmail: t.attendeeEmail,
			status: t.status
		}))
	};
};
