import { env } from '$env/dynamic/private';
import { stripe } from '$lib/server/stripe';
import { checkout } from './payment-service';
import { calculateTotalWithFeeCoverage } from './fees';

// ---------------------------------------------------------------------------
// SubscriptionService — manages Stripe subscription lifecycle
// ---------------------------------------------------------------------------
// Subscription creation delegates to the shared checkout() with
// mode: 'subscription'. This file handles lifecycle operations:
// getSubscription, updateQuantity, cancel, resume.
//
// Environment variables:
//   STRIPE_CONTRIBUTION_PRICE_ID — $5/unit recurring price
//   STRIPE_FEE_PRODUCT_ID        — product for the fee coverage line item
// ---------------------------------------------------------------------------

function getContributionPriceId(): string {
	const id = env.STRIPE_CONTRIBUTION_PRICE_ID;
	if (!id) throw new Error('STRIPE_CONTRIBUTION_PRICE_ID is not set');
	return id;
}

function getFeeProductId(): string {
	const id = env.STRIPE_FEE_PRODUCT_ID;
	if (!id) throw new Error('STRIPE_FEE_PRODUCT_ID is not set');
	return id;
}

/** Cents per contribution unit. Matches the Stripe Price configuration. */
const CONTRIBUTION_UNIT_CENTS = 500;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateSubscriptionOptions {
	userId: string;
	stripeCustomerId: string;
	quantity: number;
	coverFees: boolean;
	successUrl: string;
	cancelUrl: string;
}

export interface SubscriptionInfo {
	id: string;
	status: string;
	quantity: number;
	coveringFees: boolean;
	currentPeriodEnd: Date;
	cancelAtPeriodEnd: boolean;
}

// ---------------------------------------------------------------------------
// createCheckoutSession
// ---------------------------------------------------------------------------

/**
 * Create a subscription checkout via the shared checkout() flow.
 * Returns the checkout URL for redirect.
 */
export async function createCheckoutSession(options: CreateSubscriptionOptions): Promise<string> {
	const { userId, stripeCustomerId, quantity, coverFees, successUrl, cancelUrl } = options;

	if (quantity < 1) throw new Error('Quantity must be at least 1');

	const result = await checkout({
		userId,
		stripeCustomerId,
		mode: 'subscription',
		lineItems: [
			{ price: getContributionPriceId(), quantity }
		],
		coverFees,
		metadata: {
			subscription_type: 'contribution'
		},
		successUrl,
		cancelUrl
	});

	if (!result.checkoutUrl) {
		throw new Error('Stripe did not return a checkout URL');
	}

	return result.checkoutUrl;
}

// ---------------------------------------------------------------------------
// getSubscription
// ---------------------------------------------------------------------------

/**
 * Fetch the active subscription for a user. Returns null if none exists.
 */
export async function getSubscription(stripeCustomerId: string): Promise<SubscriptionInfo | null> {
	const subscriptions = await stripe.subscriptions.list({
		customer: stripeCustomerId,
		status: 'active',
		limit: 1,
		expand: ['data.items']
	});

	const sub = subscriptions.data[0];
	if (!sub) return null;

	const contributionPriceId = getContributionPriceId();
	const feeProductId = getFeeProductId();

	const contributionItem = sub.items.data.find((item) => item.price.id === contributionPriceId);
	const feeItem = sub.items.data.find((item) => {
		const product = item.price.product;
		return (typeof product === 'string' ? product : product.id) === feeProductId;
	});

	// In Stripe v22, current_period_end moved to subscription items
	const periodEnd = contributionItem?.current_period_end ?? 0;

	return {
		id: sub.id,
		status: sub.status,
		quantity: contributionItem?.quantity ?? 0,
		coveringFees: feeItem != null,
		currentPeriodEnd: new Date(periodEnd * 1000),
		cancelAtPeriodEnd: sub.cancel_at_period_end
	};
}

// ---------------------------------------------------------------------------
// updateQuantity
// ---------------------------------------------------------------------------

/**
 * Update the contribution quantity (and optionally fee coverage).
 * Stripe handles proration automatically.
 */
export async function updateQuantity(
	stripeCustomerId: string,
	newQuantity: number,
	coverFees: boolean
): Promise<void> {
	if (newQuantity < 1) throw new Error('Quantity must be at least 1');

	const subscriptions = await stripe.subscriptions.list({
		customer: stripeCustomerId,
		status: 'active',
		limit: 1
	});

	const sub = subscriptions.data[0];
	if (!sub) throw new Error('No active subscription found');

	const contributionPriceId = getContributionPriceId();
	const feeProductId = getFeeProductId();

	const contributionItem = sub.items.data.find((item) => item.price.id === contributionPriceId);
	const feeItem = sub.items.data.find((item) => {
		const product = item.price.product;
		return (typeof product === 'string' ? product : product.id) === feeProductId;
	});

	if (!contributionItem) throw new Error('Contribution item not found on subscription');

	const items: Array<{
		id?: string;
		price_data?: { currency: string; product: string; unit_amount: number; recurring: { interval: string } };
		quantity?: number;
		deleted?: boolean;
	}> = [
		{ id: contributionItem.id, quantity: newQuantity }
	];

	if (coverFees) {
		const contributionCents = newQuantity * CONTRIBUTION_UNIT_CENTS;
		const { feeCents } = calculateTotalWithFeeCoverage(contributionCents);

		if (feeItem) {
			items.push({ id: feeItem.id, deleted: true });
		}
		items.push({
			price_data: {
				currency: 'usd',
				product: feeProductId,
				unit_amount: feeCents,
				recurring: { interval: 'month' }
			},
			quantity: 1
		});
	} else if (feeItem) {
		items.push({ id: feeItem.id, deleted: true });
	}

	// @ts-expect-error — Stripe v22 Item type requires all fields; we only send
	// the subset needed for quantity update + price_data fee items + deleted flags.
	await stripe.subscriptions.update(sub.id, { items });
}

// ---------------------------------------------------------------------------
// cancel / resume
// ---------------------------------------------------------------------------

/**
 * Cancel the subscription at the end of the current billing period.
 */
export async function cancel(stripeCustomerId: string): Promise<void> {
	const subscriptions = await stripe.subscriptions.list({
		customer: stripeCustomerId,
		status: 'active',
		limit: 1
	});

	const sub = subscriptions.data[0];
	if (!sub) throw new Error('No active subscription found');

	await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
}

/**
 * Resume a subscription that was cancelled but hasn't reached period end yet.
 */
export async function resume(stripeCustomerId: string): Promise<void> {
	const subscriptions = await stripe.subscriptions.list({
		customer: stripeCustomerId,
		status: 'active',
		limit: 1
	});

	const sub = subscriptions.data[0];
	if (!sub) throw new Error('No active subscription found');

	if (!sub.cancel_at_period_end) {
		throw new Error('Subscription is not scheduled for cancellation');
	}

	await stripe.subscriptions.update(sub.id, { cancel_at_period_end: false });
}

// ---------------------------------------------------------------------------
// Billing portal
// ---------------------------------------------------------------------------

/**
 * Create a Stripe Billing Portal session URL. Returns null if no customer ID
 * is provided. The portal lets members manage payment methods, view invoices,
 * and cancel subscriptions.
 */
export async function createBillingPortalUrl(
	stripeCustomerId: string | null | undefined,
	returnUrl: string
): Promise<string | null> {
	if (!stripeCustomerId) return null;

	const session = await stripe.billingPortal.sessions.create({
		customer: stripeCustomerId,
		return_url: returnUrl
	});

	return session.url;
}
