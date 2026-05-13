import type Stripe from 'stripe';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/auth';
import { eq } from 'drizzle-orm';
import * as paymentService from './payment-service';
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
// The webhook handler maintains a registry of purchasable types so it can
// update the correct table when a checkout completes. Since the payment
// service is generic (doesn't know about domain models), this mapping
// lives here at the integration boundary.
// ---------------------------------------------------------------------------

/** Registry of purchasable type → table update function. */
type PurchasableUpdater = (id: string, paymentRecordId: string) => Promise<void>;
const purchasableUpdaters: Record<string, PurchasableUpdater> = {
	// Add entries as domain modules are built, e.g.:
	// reservation: async (id, paymentRecordId) => {
	//   await db.update(reservation).set({ stripePaymentRecordId: paymentRecordId }).where(eq(reservation.id, id));
	// },
};

/** Register a purchasable type handler. Called by domain modules at startup. */
export function registerPurchasableType(type: string, updater: PurchasableUpdater): void {
	purchasableUpdaters[type] = updater;
}

// ---------------------------------------------------------------------------
// Webhook handler map — colocates event types with their handler functions
// ---------------------------------------------------------------------------
// The webhook route looks up handlers by event type from this map.
// The event list in webhook-events.ts is the single source of truth used by
// both this map and the sync-webhooks script.
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
	const result = await paymentService.onCheckoutComplete(session.id);

	const updater = purchasableUpdaters[result.purchasableType];
	if (!updater) {
		console.warn(
			`No purchasable updater registered for type "${result.purchasableType}". ` +
			`Payment record ${result.paymentRecordId} not linked to ${result.purchasableId}.`
		);
		return;
	}

	await updater(result.purchasableId, result.paymentRecordId);
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

	// Find the subscription line item (has a subscription_item reference).
	// Filters out proration adjustments and tax lines.
	// The subscription uses $5/unit pricing — quantity = free hours.
	const lines = invoice.lines?.data ?? [];
	const contributionLine = lines.find(
		(line) => line.subscription_item != null && line.quantity != null && line.quantity > 0
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
