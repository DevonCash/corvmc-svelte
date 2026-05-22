import type Stripe from 'stripe';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/auth';
import { eq } from 'drizzle-orm';
import * as creditService from './credit-service';
import { cancelAllForUser } from '$lib/server/reservation/recurring-series-service';
import { registeredEvents, type RegisteredEvent } from './webhook-events';
import { domainEvents } from '$lib/server/events/event-bus';
import { sql } from 'drizzle-orm';

// Re-export so downstream consumers can import from one place
export { registeredEvents };

// ---------------------------------------------------------------------------
// Webhook event handlers
// ---------------------------------------------------------------------------
// These are called by the webhook route after signature verification.
// Each handler is responsible for one event type.
//
// checkout.session.completed emits a domain event — listeners are registered
// in register-listeners.ts. This file handles finance-specific events
// (credit allocation and subscription lifecycle) directly.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Webhook handler map
// ---------------------------------------------------------------------------

export type WebhookHandlerFn = (data: any) => Promise<void>;

export const webhookHandlerMap: Record<RegisteredEvent, WebhookHandlerFn> = {
	'checkout.session.completed': handleCheckoutCompleted,
	'invoice.paid': handleInvoicePaid,
	'customer.subscription.deleted': handleSubscriptionDeleted
};

// ---------------------------------------------------------------------------
// checkout.session.completed
// ---------------------------------------------------------------------------

export async function handleCheckoutCompleted(
	session: Stripe.Checkout.Session
): Promise<void> {
	await domainEvents.emit('checkout.completed', {
		sessionId: session.id,
		metadata: (session.metadata as Record<string, string>) ?? {},
		stripeSession: session
	});
}

// ---------------------------------------------------------------------------
// invoice.paid — allocate monthly credits from subscription
// ---------------------------------------------------------------------------

export async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
	// Only process subscription invoices
	const subDetails = invoice.parent?.subscription_details;
	if (!subDetails) return;

	const customerId = typeof invoice.customer === 'string'
		? invoice.customer
		: invoice.customer?.id;

	if (!customerId) return;

	const member = await findUserByStripeId(customerId);
	if (!member) {
		console.warn(`invoice.paid: no user found for Stripe customer ${customerId}`);
		return;
	}

	// Find the subscription line item (has subscription_item_details in parent).
	// Filters out proration adjustments and tax lines.
	// The subscription uses $5/unit pricing — quantity = free hours.
	const lines = invoice.lines?.data ?? [];
	const contributionLine = lines.find(
		(line) => line.parent?.subscription_item_details != null && line.quantity != null && line.quantity > 0
	);

	if (!contributionLine || !contributionLine.quantity) {
		console.warn(`invoice.paid: no contribution line item found for invoice ${invoice.id}`);
		return;
	}

	const freeHours = contributionLine.quantity;

	// Use invoice ID as sourceId for idempotency — each invoice is unique
	await creditService.allocateMonthlyCredits(member.id, freeHours, invoice.id);

	// Equipment credits: 1:1 with contribution level, capped at 250
	await creditService.allocateEquipmentCredits(member.id, contributionLine.quantity, invoice.id);

	await db.update(user)
		.set({ sustainingMemberSince: sql`coalesce(sustaining_member_since, current_timestamp)` })
		.where(eq(user.id, member.id));
}

// ---------------------------------------------------------------------------
// customer.subscription.deleted — reset credits
// ---------------------------------------------------------------------------

export async function handleSubscriptionDeleted(
	subscription: Stripe.Subscription
): Promise<void> {
	const customerId = typeof subscription.customer === 'string'
		? subscription.customer
		: subscription.customer.id;

	const member = await findUserByStripeId(customerId);
	if (!member) {
		console.warn(`subscription.deleted: no user found for Stripe customer ${customerId}`);
		return;
	}

	await creditService.setBalance(
		member.id,
		'free_hours',
		0,
		'monthly_allocation',
		subscription.id,
		'Subscription cancelled — free hours reset'
	);

	await creditService.setBalance(
		member.id,
		'equipment_credits',
		0,
		'monthly_allocation',
		subscription.id,
		'Subscription cancelled — equipment credits reset'
	);

	// Cancel all active recurring series for this user
	await cancelAllForUser(member.id);

	await db.update(user)
		.set({ sustainingMemberSince: null })
		.where(eq(user.id, member.id));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function findUserByStripeId(stripeCustomerId: string) {
	const [found] = await db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.stripeId, stripeCustomerId))
		.limit(1);

	return found ?? null;
}
