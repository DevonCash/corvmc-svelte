import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getSubscription,
	createBillingPortalUrl
} from '$lib/server/finance/subscription-service';
import { getAllBalances } from '$lib/server/finance/credit-service';
import { getCommunityStats } from '$lib/server/finance/community-stats';
import { calculateTotalWithFeeCoverage } from '$lib/server/finance/fees';
import { getProductConfig } from '$lib/server/finance/product-config-service';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) return error(401, 'Not authenticated');
	const user = locals.user;

	const [subscription, credits, communityStats, contributionConfig, billingPortalUrl] = await Promise.all([
		user.stripeId ? getSubscription(user.stripeId) : Promise.resolve(null),
		getAllBalances(user.id),
		getCommunityStats(),
		getProductConfig('contribution'),
		user.stripeId
			? createBillingPortalUrl(user.stripeId, `${url.origin}/member/membership`)
			: Promise.resolve(null)
	]);

	// Calculate "used this month" for the credit balance card.
	let allocatedThisMonth = 0;
	if (subscription && credits.free_hours != null) {
		allocatedThisMonth = subscription.quantity;
	}
	const usedThisMonth = Math.max(0, allocatedThisMonth - (credits.free_hours ?? 0));

	return json({
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
	});
};
