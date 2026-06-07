import { z } from 'zod';
import { redirect, error } from '@sveltejs/kit';
import { form, getRequestEvent, query } from '$app/server';
import { requireMember } from '$lib/server/authorization';
import {
	createCheckoutSession,
	getMemberSubscription,
	mapDbSubscription,
	patchMemberSubscription,
	createBillingPortalUrl,
	updateQuantity,
	resume
} from '$lib/server/finance/subscription-service';
import { getAllBalances } from '$lib/server/finance/credit-service';
import { getCommunityStats } from '$lib/server/finance/community-stats';
import { calculateTotalWithFeeCoverage } from '$lib/server/finance/fees';
import { getProductConfig } from '$lib/server/finance/product-config-service';
import { ensureStripeCustomer } from '$lib/server/finance/stripe-customer-service';
import { DOLLARS_PER_UNIT } from '$lib/config';

export const getMemberMembership = query(async () => {
	const user = await requireMember();
	const { url } = getRequestEvent();

	const [dbSubscription, credits, communityStats, contributionConfig, billingPortalUrl] =
		await Promise.all([
			getMemberSubscription(user.id),
			getAllBalances(user.id),
			getCommunityStats(),
			getProductConfig('contribution'),
			user.stripeId
				? createBillingPortalUrl(user.stripeId, `${url.origin}/member/membership`)
				: Promise.resolve(null)
		]);

	const subscription = mapDbSubscription(dbSubscription);

	// Allocation/usage are tracked in credits (30-min blocks); the UI converts to
	// hours for display via creditsToHours.
	const allocatedThisMonth = dbSubscription?.hoursPerReset ?? 0;
	const usedThisMonth = Math.max(0, allocatedThisMonth - (credits.free_hours ?? 0));

	return {
		subscription,
		credits,
		billingPortalUrl,
		communityStats,
		allocatedThisMonth,
		usedThisMonth,
		contributionUnitCents: contributionConfig.unitAmountCents,
		feeSchedule: {
			perUnit: calculateTotalWithFeeCoverage(contributionConfig.unitAmountCents).feeCents
		}
	};
});

const MIN_QUANTITY = 2;

function requireStripeId(user: { stripeId: string | null }) {
	if (!user.stripeId) throw error(400, 'No billing account found. Please contact support.');
	return user.stripeId;
}

const amountSchema = z
	.object({
		amount: z
			.string()
			.transform(Number)
			.refine(
				(n) => !isNaN(n) && n >= MIN_QUANTITY * DOLLARS_PER_UNIT,
				`Contribution must be at least $${MIN_QUANTITY * DOLLARS_PER_UNIT}/month`
			),
		coverFees: z.literal('on').optional()
	})
	.refine((d) => d.amount % DOLLARS_PER_UNIT === 0, {
		message: `Contribution must be a multiple of $${DOLLARS_PER_UNIT}`,
		path: ['amount']
	});

export const createSubscription = form(amountSchema, async (data) => {
	const user = await requireMember();
	// A brand-new member legitimately has no Stripe customer yet — create it on
	// demand (returns the existing id when present) rather than failing.
	const stripeId = await ensureStripeCustomer(user.id, user.email, user.name);
	const { url } = getRequestEvent();

	const checkoutUrl = await createCheckoutSession({
		userId: user.id,
		stripeCustomerId: stripeId,
		quantity: data.amount / DOLLARS_PER_UNIT,
		coverFees: data.coverFees === 'on',
		successUrl: `${url.origin}/member/membership`,
		cancelUrl: `${url.origin}/member/membership`
	});

	redirect(303, checkoutUrl);
});

export const updateAmount = form(amountSchema, async (data) => {
	const user = await requireMember();
	const stripeId = requireStripeId(user);

	const units = data.amount / DOLLARS_PER_UNIT;
	await updateQuantity(stripeId, units, data.coverFees === 'on');
	// Write-through so the page reflects the change before the webhook lands.
	// hoursPerReset is in credits (30-min blocks): units × 2.
	await patchMemberSubscription(user.id, {
		hoursPerReset: units * 2,
		coveringFees: data.coverFees === 'on'
	});
	return { success: true };
});

export const resumeSubscription = form(z.object({}), async () => {
	const user = await requireMember();
	const stripeId = requireStripeId(user);

	await resume(stripeId);
	await patchMemberSubscription(user.id, { cancelAtPeriodEnd: false });
	return { success: true };
});
