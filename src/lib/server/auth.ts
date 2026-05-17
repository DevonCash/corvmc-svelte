import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';

export const auth = betterAuth({
	baseURL: env.ORIGIN,
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'sqlite' }),
	emailAndPassword: { enabled: true },
	user: {
		additionalFields: {
			pronouns: { type: 'string', required: false },
			phone: { type: 'string', required: false },
			settings: { type: 'string', required: false }, // stored as jsonb in PG
			stripeId: { type: 'string', required: false, fieldName: 'stripe_id' },
			pmType: { type: 'string', required: false, fieldName: 'pm_type' },
			pmLastFour: { type: 'string', required: false, fieldName: 'pm_last_four' },
			trialEndsAt: { type: 'string', required: false, fieldName: 'trial_ends_at' },
			deletedAt: { type: 'string', required: false, fieldName: 'deleted_at' }
		}
	},
	plugins: [
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	]
});
