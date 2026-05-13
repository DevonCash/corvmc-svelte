import { stripe } from '$lib/server/stripe';
import * as creditService from './credit-service';
import { type CreditType, creditTypes } from './types';

// ---------------------------------------------------------------------------
// PaymentService — checkout, cash recording, refund, cancel
// ---------------------------------------------------------------------------

export interface CheckoutOptions {
	userId: string;
	stripeCustomerId: string;
	stripePriceId: string;
	quantity: number;
	purchasableType: string;
	purchasableId: string;
	successUrl: string;
	cancelUrl: string;
}

export interface CheckoutResult {
	paid: boolean;
	checkoutUrl?: string;
	stripePaymentRecordId?: string;
}

export interface CheckoutCompleteResult {
	purchasableType: string;
	purchasableId: string;
	paymentRecordId: string;
}

/** A single credit deduction recorded in Stripe metadata for reversal. */
interface CreditDeduction {
	type: CreditType;
	units: number;
	cents: number;
}

// ---------------------------------------------------------------------------
// checkout()
// ---------------------------------------------------------------------------

export async function checkout(options: CheckoutOptions): Promise<CheckoutResult> {
	const {
		userId,
		stripeCustomerId,
		stripePriceId,
		quantity,
		purchasableType,
		purchasableId,
		successUrl,
		cancelUrl
	} = options;

	// 1. Fetch the Stripe Price and its Product to read eligible_wallets
	const price = await stripe.prices.retrieve(stripePriceId, { expand: ['product'] });
	const product = price.product as import('stripe').Stripe.Product;
	const eligibleWalletsRaw = product.metadata?.eligible_wallets ?? '';
	const eligibleWallets = eligibleWalletsRaw
		.split(',')
		.map((w) => w.trim())
		.filter((w): w is CreditType => creditTypes.includes(w as CreditType));

	// 2. Calculate total price
	const unitAmount = price.unit_amount ?? 0;
	const totalCents = unitAmount * quantity;

	// 3. Calculate credit discount
	let creditsAppliedCents = 0;
	const creditDeductions: CreditDeduction[] = [];

	for (const walletType of eligibleWallets) {
		const balance = await creditService.getBalance(userId, walletType);
		if (balance <= 0) continue;

		const unitsToUse = Math.min(balance, quantity);
		const discountCents = unitsToUse * unitAmount;
		const applicableDiscount = Math.min(discountCents, totalCents - creditsAppliedCents);

		if (applicableDiscount > 0) {
			const actualUnits = Math.ceil(applicableDiscount / unitAmount);
			creditDeductions.push({ type: walletType, units: actualUnits, cents: applicableDiscount });
			creditsAppliedCents += applicableDiscount;
		}

		if (creditsAppliedCents >= totalCents) break;
	}

	const remainingCents = totalCents - creditsAppliedCents;

	// 4. Deduct credits (optimistically, before payment).
	//    If any deduction fails, reverse all prior ones.
	const completedDeductions: CreditDeduction[] = [];
	try {
		for (const deduction of creditDeductions) {
			await creditService.deductCredits(
				userId,
				deduction.type,
				deduction.units,
				'checkout',
				purchasableId,
				`${deduction.units} ${deduction.type} applied to ${purchasableType} ${purchasableId}`
			);
			completedDeductions.push(deduction);
		}
	} catch (err) {
		// Reverse any deductions that succeeded before the failure
		await reverseDeductions(userId, completedDeductions, purchasableId, 'checkout_failed');
		throw err;
	}

	const metadata = {
		credits_applied_cents: String(creditsAppliedCents),
		credits_breakdown: JSON.stringify(creditDeductions),
		purchasable_type: purchasableType,
		purchasable_id: purchasableId
	};

	// 5. Credits fully cover the price
	if (remainingCents <= 0) {
		const now = Math.floor(Date.now() / 1000);
		const paymentRecord = await stripe.paymentRecords.reportPayment({
			amount_requested: { value: 0, currency: 'usd' },
			initiated_at: now,
			payment_method_details: {
				custom: { display_name: 'Credits', type: 'custom' },
				type: 'custom'
			},
			metadata,
			outcome: 'guaranteed',
			guaranteed: { guaranteed_at: now },
			customer_details: { customer: stripeCustomerId }
		});

		return { paid: true, stripePaymentRecordId: paymentRecord.id };
	}

	// 6. Partial or no credit coverage — create Checkout Session
	const sessionParams: import('stripe').Stripe.Checkout.SessionCreateParams = {
		customer: stripeCustomerId,
		mode: 'payment',
		line_items: [{ price: stripePriceId, quantity }],
		success_url: successUrl,
		cancel_url: cancelUrl,
		metadata
	};

	// Apply coupon for credit discount
	if (creditsAppliedCents > 0) {
		const coupon = await stripe.coupons.create({
			amount_off: creditsAppliedCents,
			currency: 'usd',
			max_redemptions: 1,
			name: `Credit discount (${purchasableType})`
		});

		sessionParams.discounts = [{ coupon: coupon.id }];
	}

	const session = await stripe.checkout.sessions.create(sessionParams);

	return { paid: false, checkoutUrl: session.url! };
}

// ---------------------------------------------------------------------------
// onCheckoutComplete()
// ---------------------------------------------------------------------------

export async function onCheckoutComplete(sessionId: string): Promise<CheckoutCompleteResult> {
	const session = await stripe.checkout.sessions.retrieve(sessionId, {
		expand: ['payment_intent']
	});

	const purchasableType = session.metadata?.purchasable_type;
	const purchasableId = session.metadata?.purchasable_id;

	if (!purchasableType || !purchasableId) {
		throw new Error(`Checkout session ${sessionId} missing purchasable metadata`);
	}

	// The payment intent ID serves as our link to the payment
	const paymentIntent = session.payment_intent as import('stripe').Stripe.PaymentIntent;
	const paymentRecordId = paymentIntent?.id ?? session.id;

	return { purchasableType, purchasableId, paymentRecordId };
}

// ---------------------------------------------------------------------------
// recordCashPayment()
// ---------------------------------------------------------------------------

export interface CashPaymentOptions {
	userId: string;
	stripeCustomerId: string;
	amountCents: number;
	purchasableType: string;
	purchasableId: string;
}

export async function recordCashPayment(options: CashPaymentOptions): Promise<{ paymentRecordId: string }> {
	const { stripeCustomerId, amountCents, purchasableType, purchasableId } = options;

	const now = Math.floor(Date.now() / 1000);
	const paymentRecord = await stripe.paymentRecords.reportPayment({
		amount_requested: { value: amountCents, currency: 'usd' },
		initiated_at: now,
		payment_method_details: {
			custom: { display_name: 'Cash', type: 'custom' },
			type: 'custom'
		},
		metadata: {
			purchasable_type: purchasableType,
			purchasable_id: purchasableId
		},
		outcome: 'guaranteed',
		guaranteed: { guaranteed_at: now },
		customer_details: { customer: stripeCustomerId }
	});

	return { paymentRecordId: paymentRecord.id };
}

// ---------------------------------------------------------------------------
// refund()
// ---------------------------------------------------------------------------

export interface RefundOptions {
	userId: string;
	purchasableType: string;
	purchasableId: string;
	stripePaymentRecordId: string;
}

export async function refund(options: RefundOptions): Promise<void> {
	const { userId, purchasableType, purchasableId, stripePaymentRecordId } = options;

	const paymentRecord = await stripe.paymentRecords.retrieve(stripePaymentRecordId);
	const paymentAmount = paymentRecord.amount?.value ?? 0;

	// Refund the card payment if there was one
	if (paymentAmount > 0) {
		const now = Math.floor(Date.now() / 1000);
		await stripe.paymentRecords.reportRefund(stripePaymentRecordId, {
			amount: { value: paymentAmount, currency: 'usd' },
			initiated_at: now,
			outcome: 'refunded',
			refunded: { refunded_at: now },
			processor_details: { type: 'custom' }
		});
	}

	// Reverse credit deductions using the stored breakdown
	const deductions = parseBreakdown(paymentRecord.metadata);
	await reverseDeductions(userId, deductions, stripePaymentRecordId, 'refund');
}

// ---------------------------------------------------------------------------
// cancel()
// ---------------------------------------------------------------------------

export interface CancelOptions {
	userId: string;
	purchasableType: string;
	purchasableId: string;
	stripeCheckoutSessionId?: string;
}

export async function cancel(options: CancelOptions): Promise<void> {
	const { userId, purchasableType, purchasableId, stripeCheckoutSessionId } = options;

	if (!stripeCheckoutSessionId) return;

	const session = await stripe.checkout.sessions.retrieve(stripeCheckoutSessionId);

	// Reverse credit deductions using the stored breakdown
	const deductions = parseBreakdown(session.metadata);
	await reverseDeductions(userId, deductions, stripeCheckoutSessionId, 'cancelled');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse credits_breakdown from Stripe metadata. */
function parseBreakdown(metadata: Record<string, string> | null | undefined): CreditDeduction[] {
	const raw = metadata?.credits_breakdown;
	if (!raw) return [];

	try {
		const parsed = JSON.parse(raw) as CreditDeduction[];
		return parsed.filter((d) => creditTypes.includes(d.type) && d.units > 0);
	} catch {
		return [];
	}
}

/** Reverse a list of credit deductions back to the user's wallets. */
async function reverseDeductions(
	userId: string,
	deductions: CreditDeduction[],
	sourceId: string,
	source: string
): Promise<void> {
	for (const deduction of deductions) {
		await creditService.addCredits(
			userId,
			deduction.type,
			deduction.units,
			source,
			sourceId,
			`Reversed ${deduction.units} ${deduction.type}`
		);
	}
}
