import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { stripe } from '$lib/server/stripe';
import { webhookHandlerMap } from '$lib/server/finance/webhook-handlers';
import { captureException } from '$lib/server/sentry';

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
		// Note: this endpoint may be probed by scanners, so signature failures can be
		// somewhat noisy. Acceptable at current volume; gate or drop if it floods Sentry.
		captureException(err, { stage: 'signature_verification' });
		error(400, 'Invalid signature');
	}

	const handler = webhookHandlerMap[event.type as keyof typeof webhookHandlerMap];
	if (handler) {
		if (import.meta.env.DEV) {
			await handler(event.data.object);
		} else {
			try {
				await handler(event.data.object);
			} catch (err) {
				const customerId = (event.data.object as { customer?: unknown })?.customer;
				captureException(err, {
					stage: 'handler',
					eventType: event.type,
					eventId: event.id,
					customerId: typeof customerId === 'string' ? customerId : undefined
				});
				// TODO(stripe-retry): we still return 200 below, so Stripe will not re-deliver
				// this failed event. Once every handler is confirmed idempotent (see the
				// idempotency audit in CHORES.md), return 500 here so Stripe retries instead
				// of silently dropping the work.
			}
		}
	}

	return json({ received: true });
};
