import type Stripe from 'stripe';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/auth';
import { eq } from 'drizzle-orm';
import * as creditService from './credit-service';
import { registeredEvents, type RegisteredEvent } from './webhook-events';

// Re-export so downstream consumers can import from one place
export { registeredEvents };

// ---------------------------------------------------------------------------
// Webhook event handlers
// ---------------------------------------------------------------------------
// These are called by the webhook route after signature verification.
// Each handler is responsible for one event type.
//
// checkout.session.completed is handled by domain modules that register
// listeners. This file only handles finance-specific events (credit
// allocation and subscription lifecycle).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Checkout completion listeners
// ---------------------------------------------------------------------------
// Domain modules register listeners that are called with the completed
// session. Each listener inspects the session metadata to decide whether
// to act (e.g., a reservation module checks for its reservation_id key).
// ---------------------------------------------------------------------------

type CheckoutListener = (session: Stripe.Checkout.Session) => Promise<void>;
const checkoutListeners: CheckoutListener[] = [];

/** Register a listener for checkout completion. Called by domain modules at startup. */
export function onCheckoutComplete(listener: CheckoutListener): void {
	checkoutListeners.push(listener);
}

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
	for (const listener of checkoutListeners) {
		try {
			await listener(session);
		} catch (err) {
			console.error(`Checkout listener failed for session ${session.id}:`, err);
		}
	}
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
