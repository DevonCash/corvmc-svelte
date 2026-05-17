import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { hashPassword, verifyPassword } from 'better-auth/crypto';
import bcrypt from 'bcryptjs';
import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { account } from '$lib/server/db/schema/auth';
import { eq } from 'drizzle-orm';

export const auth = betterAuth({
	baseURL: env.ORIGIN,
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'sqlite' }),
	emailAndPassword: {
		enabled: true,
		password: {
			verify: async ({ hash, password }) => {
				if (hash.startsWith('$2')) {
					const normalized = hash.replace(/^\$2y\$/, '$2a$');
					const valid = await bcrypt.compare(password, normalized);
					if (valid) {
						const scryptHash = await hashPassword(password);
						await db
							.update(account)
							.set({ password: scryptHash })
							.where(eq(account.password, hash));
					}
					return valid;
				}
				return verifyPassword({ hash, password });
			},
			hash: hashPassword
		}
	},
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
