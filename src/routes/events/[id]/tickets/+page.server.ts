import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getById } from '$lib/server/event/event-service';
import { getTicketsRemaining, createTickets } from '$lib/server/ticket/ticket-service';
import { getPublicUrl, isConfigured } from '$lib/server/storage';
import { getSubscription } from '$lib/server/finance/subscription-service';
import { checkout } from '$lib/server/finance/payment-service';
import { buildLineItem } from '$lib/server/finance/product-config-service';
import { randomUUID } from 'crypto';

export const load: PageServerLoad = async ({ params, locals }) => {
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

	return {
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
	};
};

export const actions: Actions = {
	purchase: async ({ params, locals, url, request }) => {
		const evt = await getById(params.id);
		if (!evt) return fail(404, { error: 'Event not found' });
		if (evt.status !== 'published') return fail(400, { error: 'Event is not published' });
		if (!evt.ticketingEnabled || !evt.ticketPrice) return fail(400, { error: 'Tickets not available' });

		const formData = await request.formData();
		const quantity = parseInt(formData.get('quantity') as string, 10);
		const attendeeName = (formData.get('attendeeName') as string)?.trim();
		const attendeeEmail = (formData.get('attendeeEmail') as string)?.trim();
		const coverFees = formData.get('coverFees') === 'on';

		if (!quantity || quantity < 1 || quantity > 10) {
			return fail(400, { error: 'Quantity must be between 1 and 10' });
		}
		if (!attendeeName) return fail(400, { error: 'Name is required' });
		if (!attendeeEmail || !attendeeEmail.includes('@')) {
			return fail(400, { error: 'Valid email is required' });
		}

		// Check capacity
		const remaining = await getTicketsRemaining(params.id);
		if (remaining !== null && quantity > remaining) {
			return fail(400, {
				error: remaining === 0 ? 'This event is sold out' : `Only ${remaining} tickets remaining`
			});
		}

		// Generate purchase ID
		const purchaseId = randomUUID();

		// Create pending tickets
		await createTickets({
			eventId: evt.id,
			purchaseId,
			quantity,
			userId: locals.user?.id ?? undefined,
			attendeeName,
			attendeeEmail,
			status: 'pending'
		});

		// Build checkout — apply sustaining member discount if applicable
		let unitPrice = evt.ticketPrice;
		if (locals.user?.stripeId) {
			const sub = await getSubscription(locals.user.stripeId);
			if (sub) {
				unitPrice = Math.round(unitPrice / 2);
			}
		}

		const lineItem = await buildLineItem('ticket', unitPrice, quantity);

		const checkoutOptions: Parameters<typeof checkout>[0] = {
			stripeCustomerId: locals.user?.stripeId ?? undefined,
			userId: locals.user?.id ?? undefined,
			mode: 'payment',
			lineItems: [lineItem],
			coverFees,
			metadata: {
				type: 'ticket',
				purchase_id: purchaseId,
				event_id: evt.id,
				ticket_quantity: String(quantity)
			},
			successUrl: `${url.origin}/events/${evt.id}/tickets/success?purchase_id=${purchaseId}`,
			cancelUrl: `${url.origin}/events/${evt.id}/tickets`
		};

		const result = await checkout(checkoutOptions);

		if (result.paid) {
			// Credits fully covered it — fulfill immediately
			const { fulfillPurchase } = await import('$lib/server/ticket/ticket-service');
			await fulfillPurchase(purchaseId);
			return redirect(303, `/events/${evt.id}/tickets/success?purchase_id=${purchaseId}`);
		}

		return redirect(303, result.checkoutUrl!);
	}
};
