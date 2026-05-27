/**
 * Webhook event registry — the single source of truth for which Stripe events
 * the application handles. This file has no side-effect imports, so it can be
 * used both by the SvelteKit webhook route and by standalone scripts (e.g.
 * scripts/sync-webhooks.ts).
 */

export const registeredEvents = [
	'checkout.session.completed',
	'invoice.paid',
	'customer.subscription.updated',
	'customer.subscription.deleted'
] as const;

export type RegisteredEvent = (typeof registeredEvents)[number];
