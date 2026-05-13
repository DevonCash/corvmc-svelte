import Stripe from 'stripe';
import { env } from '$env/dynamic/private';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
	if (!_stripe) {
		if (!env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not set');
		_stripe = new Stripe(env.STRIPE_SECRET_KEY);
	}
	return _stripe;
}

/** Convenience re-export for existing call sites. */
export const stripe = new Proxy({} as Stripe, {
	get(_, prop) {
		return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
	}
});
