import { z } from 'zod';
import { command } from '$app/server';
import { getById } from '$lib/server/event/event-service';
import { getTicketsRemaining, createTickets } from '$lib/server/ticket/ticket-service';
import { getSubscription } from '$lib/server/finance/subscription-service';
import { checkout } from '$lib/server/finance/payment-service';
import { buildLineItem } from '$lib/server/finance/product-config-service';
import { getRequestEvent } from '$app/server';
import { randomUUID } from 'crypto';

export const purchaseTickets = command(
	z.object({
		eventId: z.string(),
		quantity: z.coerce.number().int().min(1).max(10),
		attendeeName: z.string().min(1),
		attendeeEmail: z.string().email(),
		coverFees: z.boolean().default(false)
	}),
	async (data) => {
		const { locals, url } = getRequestEvent();

		const evt = await getById(data.eventId);
		if (!evt) throw new Error('Event not found');
		if (evt.status !== 'published') throw new Error('Event is not published');
		if (!evt.ticketingEnabled || !evt.ticketPrice) throw new Error('Tickets not available');

		const remaining = await getTicketsRemaining(data.eventId);
		if (remaining !== null && data.quantity > remaining) {
			throw new Error(
				remaining === 0 ? 'This event is sold out' : `Only ${remaining} tickets remaining`
			);
		}

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
			userId: locals.user?.id ?? undefined,
			mode: 'payment',
			lineItems: [lineItem],
			coverFees: data.coverFees,
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
