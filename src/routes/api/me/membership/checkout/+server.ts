import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { createCheckoutSession } from '$lib/server/finance/subscription-service';
import { DOLLARS_PER_UNIT } from '$lib/config';

const MIN_QUANTITY = 2;

function parseQuantity(amount: number): number {
	if (isNaN(amount) || amount < MIN_QUANTITY * DOLLARS_PER_UNIT) {
		throw new Error(`Contribution must be at least $${MIN_QUANTITY * DOLLARS_PER_UNIT}/month`);
	}
	if (amount % DOLLARS_PER_UNIT !== 0) {
		throw new Error(`Contribution must be a multiple of $${DOLLARS_PER_UNIT}`);
	}
	return amount / DOLLARS_PER_UNIT;
}

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) return json({ error: 'Not authenticated' }, { status: 401 });
	const user = locals.user;
	if (!user.stripeId) {
		return json({ error: 'No billing account found. Please contact support.' }, { status: 400 });
	}

	const formData = await request.formData();

	let quantity: number;
	try {
		quantity = parseQuantity(Number(formData.get('amount')));
	} catch (e) {
		return json({ error: (e as Error).message }, { status: 400 });
	}

	const coverFees = formData.get('coverFees') === 'on';
	const origin = (formData.get('origin') as string) || '';

	try {
		const checkoutUrl = await createCheckoutSession({
			userId: user.id,
			stripeCustomerId: user.stripeId,
			quantity,
			coverFees,
			successUrl: `${origin}/member/membership`,
			cancelUrl: `${origin}/member/membership`
		});

		return json({ redirectUrl: checkoutUrl });
	} catch (e) {
		return json({ error: (e as Error).message }, { status: 500 });
	}
};
