import { env } from '$env/dynamic/private';
import { stripe } from '$lib/server/stripe';
import { calculateTotalWithFeeCoverage } from './fees';

// ---------------------------------------------------------------------------
// SubscriptionService — manages Stripe subscription lifecycle
// ---------------------------------------------------------------------------
// Members subscribe at a sliding scale ($5/unit/month). Quantity = monthly
// contribution units = free hours. Fee coverage is a separate line item so
// the contribution quantity stays clean for the webhook handler.
//
// Environment variables:
//   STRIPE_CONTRIBUTION_PRICE_ID — $5/unit recurring price
//   STRIPE_FEE_COVERAGE_PRICE_ID — per-unit price for fee coverage
// ---------------------------------------------------------------------------

function getContributionPriceId(): string {
	const id = env.STRIPE_CONTRIBUTION_PRICE_ID;
	if (!id) throw new Error('STRIPE_CONTRIBUTION_PRICE_ID is not set');
	return id;
}

function getFeeCoveragePriceId(): string {
	const id = env.STRIPE_FEE_COVERAGE_PRICE_ID;
	if (!id) throw new Error('STRIPE_FEE_COVERAGE_PRICE_ID is not set');
	return id;
}

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
 * Create a Stripe Checkout Session in subscription mode.
 * Returns the checkout URL for redirect.
 */
export async function createCheckoutSession(options: CreateSubscriptionOptions): Promise<string> {
	const { stripeCustomerId, quantity, coverFees, successUrl, cancelUrl } = options;

	if (quantity < 1) throw new Error('Quantity must be at least 1');

	const lineItems: Array<{ price: string; quantity: number }> = [
		{ price: getContributionPriceId(), quantity }
	];

	if (coverFees) {
		// Calculate the fee for the full contribution amount.
		// The contribution is $5/unit × quantity in cents.
		const contributionCents = quantity * 500;
		const { feeCents } = calculateTotalWithFeeCoverage(contributionCents);

		// Fee coverage price is $0.01/unit — quantity = fee in cents
		lineItems.push({ price: getFeeCoveragePriceId(), quantity: feeCents });
	}

	const session = await stripe.checkout.sessions.create({
		customer: stripeCustomerId,
		mode: 'subscription',
		line_items: lineItems,
		success_url: successUrl,
		cancel_url: cancelUrl,
		metadata: {
			user_id: options.userId,
			cover_fees: coverFees ? '1' : '0'
		}
	});

	if (!session.url) {
		throw new Error('Stripe did not return a checkout URL');
	}

	return session.url;
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

	// Find the contribution item (the one using the contribution price)
	const contributionPriceId = getContributionPriceId();
	const feePriceId = getFeeCoveragePriceId();

	const contributionItem = sub.items.data.find((item) => item.price.id === contributionPriceId);
	const feeItem = sub.items.data.find((item) => item.price.id === feePriceId);

	return {
		id: sub.id,
		status: sub.status,
		quantity: contributionItem?.quantity ?? 0,
		coveringFees: feeItem != null,
		currentPeriodEnd: new Date(sub.current_period_end * 1000),
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
	const feePriceId = getFeeCoveragePriceId();

	const contributionItem = sub.items.data.find((item) => item.price.id === contributionPriceId);
	const feeItem = sub.items.data.find((item) => item.price.id === feePriceId);

	if (!contributionItem) throw new Error('Contribution item not found on subscription');

	const items: Array<{ id?: string; price?: string; quantity?: number; deleted?: boolean }> = [
		{ id: contributionItem.id, quantity: newQuantity }
	];

	if (coverFees) {
		const contributionCents = newQuantity * 500;
		const { feeCents } = calculateTotalWithFeeCoverage(contributionCents);

		if (feeItem) {
			// Update existing fee item
			items.push({ id: feeItem.id, quantity: feeCents });
		} else {
			// Add fee coverage item
			items.push({ price: feePriceId, quantity: feeCents });
		}
	} else if (feeItem) {
		// Remove fee coverage item
		items.push({ id: feeItem.id, deleted: true });
	}

	await stripe.subscriptions.update(sub.id, { items });
}

// ---------------------------------------------------------------------------
// cancel / resume
// ---------------------------------------------------------------------------

/**
 * Cancel the subscription at the end of the current billing period.
 * Credits remain available until period end; the subscription.deleted
 * webhook will reset them.
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
