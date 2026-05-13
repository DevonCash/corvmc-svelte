import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { stripe } from '$lib/server/stripe';
import { webhookHandlerMap } from '$lib/server/finance/webhook-handlers';

export const POST: RequestHandler = async ({ request }) => {
	const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
	if (!webhookSecret) {
		error(500, 'STRIPE_WEBHOOK_SECRET is not configured');
	}

	const body = await request.text();
	const signature = request.headers.get('stripe-signature');

	if (!signature) {
		error(400, 'Missing stripe-signature header');
	}

	let event;
	try {
		event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
	} catch (err) {
		console.error('Webhook signature verification failed:', err);
		error(400, 'Invalid signature');
	}

	const handler = webhookHandlerMap[event.type as keyof typeof webhookHandlerMap];
	if (handler) {
		try {
			await handler(event.data.object);
		} catch (err) {
			// Log but return 200 to prevent Stripe from retrying indefinitely.
			// Transient failures will be caught by monitoring/alerting rather than
			// relying on Stripe's retry mechanism which risks duplicate processing.
			console.error(`Webhook handler failed for ${event.type} (${event.id}):`, err);
		}
	}

	return json({ received: true });
};
