import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { query, form, getRequestEvent } from '$app/server';
import { requireBandOwner } from '$lib/server/band/band-context';
import { getBySlug } from '$lib/server/band/band-service';
import { requireUser } from '$lib/server/authorization';
import { requireFeature } from '$lib/server/feature-flags';
import {
	getBandSubscription,
	createBandPremiumCheckout,
	cancelBandSubscription,
	resumeBandSubscription
} from '$lib/server/band/band-subscription-service';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const getBandSubscriptionInfo = query(z.string(), async (slug) => {
	await requireFeature('bandPremium');
	requireUser();
	const band = await getBySlug(slug);
	if (!band) throw error(404, 'Band not found');

	const subscription = await getBandSubscription(band.id);

	return {
		tier: band.tier,
		subscription
	};
});

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

export const upgradeToPremium = form(
	z.object({
		slug: z.string().min(1),
		billingInterval: z.enum(['monthly', 'yearly'])
	}),
	async (data) => {
		const { user, band } = await requireBandOwner();

		if (band.tier === 'premium') {
			throw error(400, 'Band already has premium tier');
		}

		if (!user.stripeId) {
			throw error(
				400,
				'Payment method required. Please set up billing in your membership settings first.'
			);
		}

		const { url } = getRequestEvent();
		const checkoutUrl = await createBandPremiumCheckout({
			bandId: band.id,
			stripeCustomerId: user.stripeId,
			billingInterval: data.billingInterval,
			successUrl: `${url.origin}/band/${band.slug}/subscription?success=true`,
			cancelUrl: `${url.origin}/band/${band.slug}/subscription`
		});

		return { redirectUrl: checkoutUrl };
	}
);

export const cancelPremium = form(z.object({ slug: z.string().min(1) }), async () => {
	const { band } = await requireBandOwner();
	await cancelBandSubscription(band.id);
	return { success: true };
});

export const resumePremium = form(z.object({ slug: z.string().min(1) }), async () => {
	const { band } = await requireBandOwner();
	await resumeBandSubscription(band.id);
	return { success: true };
});
