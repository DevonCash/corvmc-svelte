import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getById } from '$lib/server/event/event-service';
import { getTicketsRemaining } from '$lib/server/ticket/ticket-service';
import { resolveImageUrl } from '$lib/server/storage';
import { getSubscription } from '$lib/server/finance/subscription-service';

export const GET: RequestHandler = async ({ params, locals }) => {
	const evt = await getById(params.id);
	if (!evt) throw error(404, 'Event not found');
	if (evt.status !== 'published') throw error(404, 'Event not found');

	const posterUrl = resolveImageUrl(evt.posterKey);

	let remaining: number | null = null;
	if (evt.ticketingEnabled) {
		remaining = await getTicketsRemaining(params.id);
	}

	let isSustainingMember = false;
	if (locals.user?.stripeId) {
		const sub = await getSubscription(locals.user.stripeId);
		isSustainingMember = sub !== null;
	}

	return json({
		event: {
			id: evt.id,
			title: evt.title,
			description: evt.description,
			startsAt: evt.startsAt.toISOString(),
			endsAt: evt.endsAt.toISOString(),
			doorsAt: evt.doorsAt?.toISOString() ?? null,
			tags: evt.tags,
			posterUrl,
			ticketingEnabled: evt.ticketingEnabled,
			ticketPrice: evt.ticketPrice,
			ticketQuantity: evt.ticketQuantity
		},
		remaining,
		isSustainingMember
	});
};
