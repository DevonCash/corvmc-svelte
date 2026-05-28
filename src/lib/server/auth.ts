import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { hashPassword, verifyPassword } from 'better-auth/crypto';
import { compare } from 'bcrypt-ts';
import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { account } from '$lib/server/db/schema/authentication';
import { eq } from 'drizzle-orm';

// Lazy-initialize auth on first access. On Cloudflare, $env/dynamic/private
// values aren't available at module initialization — only during request
// handling. Creating betterAuth() at module scope would capture undefined
// for secret/baseURL.

let _auth: ReturnType<typeof betterAuth> | undefined;

function createAuth() {
	return betterAuth({
		baseURL: env.ORIGIN || undefined,
		secret: env.BETTER_AUTH_SECRET,
		database: drizzleAdapter(db, { provider: 'sqlite', schema }),
		emailAndPassword: {
			enabled: true,
			password: {
				verify: async ({ hash, password }) => {
					if (hash.startsWith('$2')) {
						const normalized = hash.replace(/^\$2y\$/, '$2a$');
						const valid = await compare(password, normalized);
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
				subscription: { type: 'string', required: false },
				trialEndsAt: { type: 'string', required: false, fieldName: 'trial_ends_at' },
				deletedAt: { type: 'string', required: false, fieldName: 'deleted_at' }
			}
		},
		plugins: [
			sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
		]
	});
}

export const auth = new Proxy({} as ReturnType<typeof betterAuth>, {
	get(_target, prop, receiver) {
		if (!_auth) _auth = createAuth();
		return Reflect.get(_auth, prop, receiver);
	}
});
