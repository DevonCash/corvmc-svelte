import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import {
	getSubscription,
	createCheckoutSession,
	updateQuantity,
	resume,
	createBillingPortalUrl
} from '$lib/server/finance/subscription-service';
import { getAllBalances } from '$lib/server/finance/credit-service';
import { getCommunityStats } from '$lib/server/finance/community-stats';
import { calculateTotalWithFeeCoverage } from '$lib/server/finance/fees';
import { getProductConfig } from '$lib/server/finance/product-config-service';
import { DOLLARS_PER_UNIT } from '$lib/finance/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum quantity (at $DOLLARS_PER_UNIT/unit, this enforces the $10/month minimum). */
const MIN_QUANTITY = 2;

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

export const load: PageServerLoad = async (event) => {
	const user = event.locals.user!;

	const [subscription, credits, communityStats, contributionConfig, billingPortalUrl] = await Promise.all([
		user.stripeId ? getSubscription(user.stripeId) : Promise.resolve(null),
		getAllBalances(user.id),
		getCommunityStats(),
		getProductConfig('contribution'),
		user.stripeId
			? createBillingPortalUrl(user.stripeId, `${event.url.origin}/member/membership`)
			: Promise.resolve(null)
	]);

	// Calculate "used this month" for the credit balance card.
	// The most recent monthly_allocation amount is the total for this period;
	// current balance is what's left.
	let allocatedThisMonth = 0;
	if (subscription && credits.free_hours != null) {
		// Subscription quantity = free hours allocated this month
		allocatedThisMonth = subscription.quantity;
	}
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
			// Pre-calculate some example fees for the subscription form
			perUnit: calculateTotalWithFeeCoverage(contributionConfig.unitAmountCents).feeCents
		}
	};
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function parseQuantity(formData: FormData): number {
	const dollars = Number(formData.get('amount'));
	if (isNaN(dollars) || dollars < MIN_QUANTITY * DOLLARS_PER_UNIT) {
		throw new Error(`Contribution must be at least $${MIN_QUANTITY * DOLLARS_PER_UNIT}/month`);
	}
	if (dollars % DOLLARS_PER_UNIT !== 0) {
		throw new Error(`Contribution must be a multiple of $${DOLLARS_PER_UNIT}`);
	}
	return dollars / DOLLARS_PER_UNIT;
}

export const actions: Actions = {
	createSubscription: async (event) => {
		if (!event.locals.user) return fail(401, { message: 'Not authenticated' });
		const user = event.locals.user;
		if (!user.stripeId) {
			return fail(400, { message: 'No billing account found. Please contact support.' });
		}

		const formData = await event.request.formData();

		let quantity: number;
		try {
			quantity = parseQuantity(formData);
		} catch (e) {
			return fail(400, { message: (e as Error).message });
		}

		const coverFees = formData.get('coverFees') === 'on';

		try {
			const checkoutUrl = await createCheckoutSession({
				userId: user.id,
				stripeCustomerId: user.stripeId,
				quantity,
				coverFees,
				successUrl: `${event.url.origin}/member/membership`,
				cancelUrl: `${event.url.origin}/member/membership`
			});

			return redirect(303, checkoutUrl);
		} catch (e) {
			return fail(500, { message: (e as Error).message });
		}
	},

	updateAmount: async (event) => {
		if (!event.locals.user) return fail(401, { message: 'Not authenticated' });
		const user = event.locals.user;
		if (!user.stripeId) {
			return fail(400, { message: 'No billing account found.' });
		}

		const formData = await event.request.formData();

		let quantity: number;
		try {
			quantity = parseQuantity(formData);
		} catch (e) {
			return fail(400, { message: (e as Error).message });
		}

		const coverFees = formData.get('coverFees') === 'on';

		try {
			await updateQuantity(user.stripeId, quantity, coverFees);
			return { success: true };
		} catch (e) {
			return fail(500, { message: (e as Error).message });
		}
	},

	resumeSubscription: async (event) => {
		if (!event.locals.user) return fail(401, { message: 'Not authenticated' });
		const user = event.locals.user;
		if (!user.stripeId) {
			return fail(400, { message: 'No billing account found.' });
		}

		try {
			await resume(user.stripeId);
			return { success: true };
		} catch (e) {
			return fail(500, { message: (e as Error).message });
		}
	}
};
