import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getById } from '$lib/server/event/event-service';
import { getTicketsRemaining } from '$lib/server/ticket/ticket-service';
import { getPublicUrl, isConfigured } from '$lib/server/storage';
import { getSubscription } from '$lib/server/finance/subscription-service';

export const GET: RequestHandler = async ({ params, locals }) => {
	const evt = await getById(params.id);
	if (!evt) throw error(404, 'Event not found');
	if (evt.status !== 'published') throw error(404, 'Event not found');
	if (!evt.ticketingEnabled || !evt.ticketPrice) throw error(404, 'Tickets not available for this event');

	const remaining = await getTicketsRemaining(params.id);

	// Check if logged-in user is a sustaining member (50% discount)
	let isSustainingMember = false;
	if (locals.user?.stripeId) {
		const sub = await getSubscription(locals.user.stripeId);
		isSustainingMember = sub !== null;
	}

	const posterUrl = evt.posterKey && isConfigured() ? getPublicUrl(evt.posterKey) : null;

	return json({
		event: {
			id: evt.id,
			title: evt.title,
			description: evt.description,
			startsAt: evt.startsAt.toISOString(),
			endsAt: evt.endsAt.toISOString(),
			doorsAt: evt.doorsAt?.toISOString() ?? null,
			ticketPrice: evt.ticketPrice,
			ticketQuantity: evt.ticketQuantity
		},
		remaining,
		isSustainingMember,
		posterUrl,
		isAuthenticated: !!locals.user
	});
};
