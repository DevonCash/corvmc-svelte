import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getById } from '$lib/server/event/event-service';
import { getTicketsRemaining, createTickets } from '$lib/server/ticket/ticket-service';
import { getSubscription } from '$lib/server/finance/subscription-service';
import { checkout } from '$lib/server/finance/payment-service';
import { buildLineItem } from '$lib/server/finance/product-config-service';
import { randomUUID } from 'crypto';

export const POST: RequestHandler = async ({ params, locals, request }) => {
	const evt = await getById(params.id);
	if (!evt) return json({ error: 'Event not found' }, { status: 404 });
	if (evt.status !== 'published') return json({ error: 'Event is not published' }, { status: 400 });
	if (!evt.ticketingEnabled || !evt.ticketPrice) return json({ error: 'Tickets not available' }, { status: 400 });

	const formData = await request.formData();
	const quantity = parseInt(formData.get('quantity') as string, 10);
	const attendeeName = (formData.get('attendeeName') as string)?.trim();
	const attendeeEmail = (formData.get('attendeeEmail') as string)?.trim();
	const coverFees = formData.get('coverFees') === 'on';
	const origin = (formData.get('origin') as string) || '';

	if (!quantity || quantity < 1 || quantity > 10) {
		return json({ error: 'Quantity must be between 1 and 10' }, { status: 400 });
	}
	if (!attendeeName) return json({ error: 'Name is required' }, { status: 400 });
	if (!attendeeEmail || !attendeeEmail.includes('@')) {
		return json({ error: 'Valid email is required' }, { status: 400 });
	}

	// Check capacity
	const remaining = await getTicketsRemaining(params.id);
	if (remaining !== null && quantity > remaining) {
		return json(
			{
				error: remaining === 0 ? 'This event is sold out' : `Only ${remaining} tickets remaining`
			},
			{ status: 400 }
		);
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
		successUrl: `${origin}/events/${evt.id}/tickets/success?purchase_id=${purchaseId}`,
		cancelUrl: `${origin}/events/${evt.id}/tickets`
	};

	const result = await checkout(checkoutOptions);

	if (result.paid) {
		// Credits fully covered it — fulfill immediately
		const { fulfillPurchase } = await import('$lib/server/ticket/ticket-service');
		await fulfillPurchase(purchaseId);
		return json({
			success: true,
			redirectUrl: `${origin}/events/${evt.id}/tickets/success?purchase_id=${purchaseId}`
		});
	}

	return json({ redirectUrl: result.checkoutUrl! });
};
