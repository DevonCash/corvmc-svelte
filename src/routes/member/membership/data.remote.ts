import { z } from 'zod';
import { redirect, error } from '@sveltejs/kit';
import { form, command, getRequestEvent } from '$app/server';
import { requireMember } from '$lib/server/authorization';
import {
	createCheckoutSession,
	updateQuantity,
	resume
} from '$lib/server/finance/subscription-service';
import { DOLLARS_PER_UNIT } from '$lib/config';

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
			.refine((n) => !isNaN(n) && n >= MIN_QUANTITY * DOLLARS_PER_UNIT, `Contribution must be at least $${MIN_QUANTITY * DOLLARS_PER_UNIT}/month`),
		coverFees: z.literal('on').optional()
	})
	.refine((d) => d.amount % DOLLARS_PER_UNIT === 0, {
		message: `Contribution must be a multiple of $${DOLLARS_PER_UNIT}`,
		path: ['amount']
	});

export const createSubscription = form(amountSchema, async (data) => {
	const user = await requireMember();
	const stripeId = requireStripeId(user);
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

	await updateQuantity(stripeId, data.amount / DOLLARS_PER_UNIT, data.coverFees === 'on');
	return { success: true };
});

export const resumeSubscription = command(z.void(), async () => {
	const user = await requireMember();
	const stripeId = requireStripeId(user);

	await resume(stripeId);
	return { success: true };
});
