import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import {
	createCheckoutSession,
	updateQuantity,
	resume
} from '$lib/server/finance/subscription-service';
import { DOLLARS_PER_UNIT } from '$lib/finance/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum quantity (at $DOLLARS_PER_UNIT/unit, this enforces the $10/month minimum). */
const MIN_QUANTITY = 2;

// ---------------------------------------------------------------------------
// Helpers
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

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

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
