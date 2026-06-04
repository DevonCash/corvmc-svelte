import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { account } from '$lib/server/db/schema/authentication';
import { user } from '$lib/server/db/schema/authentication';
import { eq, and } from 'drizzle-orm';
// ---------------------------------------------------------------------------
// PBKDF2 password hashing via Web Crypto API
// ---------------------------------------------------------------------------
// @noble/hashes scrypt is silently broken on Cloudflare Workers — it returns
// in 0ms with non-deterministic garbage. bcrypt-ts has the same issue.
// PBKDF2-SHA-256 via Web Crypto is natively supported on Workers.
// Format: "pbkdf2:iterations:salt_hex:key_hex"
// ---------------------------------------------------------------------------

const PBKDF2_ITERATIONS = 600_000;
const PBKDF2_KEY_LEN = 32;

function hexEncode(buf: ArrayBuffer | Uint8Array): string {
	const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
	return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexDecode(hex: string): Uint8Array<ArrayBuffer> {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < hex.length; i += 2) {
		bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
	}
	return bytes;
}

async function pbkdf2Hash(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const encoder = new TextEncoder();
	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		encoder.encode(password),
		'PBKDF2',
		false,
		['deriveBits']
	);
	const derived = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
		keyMaterial,
		PBKDF2_KEY_LEN * 8
	);
	return `pbkdf2:${PBKDF2_ITERATIONS}:${hexEncode(salt)}:${hexEncode(derived)}`;
}

async function pbkdf2Verify(hash: string, password: string): Promise<boolean> {
	const parts = hash.split(':');
	if (parts[0] !== 'pbkdf2' || parts.length !== 4) return false;

	const iterations = parseInt(parts[1], 10);
	const salt = hexDecode(parts[2]);
	const expectedKey = hexDecode(parts[3]);

	const encoder = new TextEncoder();
	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		encoder.encode(password),
		'PBKDF2',
		false,
		['deriveBits']
	);
	const derived = new Uint8Array(
		await crypto.subtle.deriveBits(
			{ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
			keyMaterial,
			expectedKey.length * 8
		)
	);

	if (derived.length !== expectedKey.length) return false;
	let diff = 0;
	for (let i = 0; i < derived.length; i++) {
		diff |= derived[i] ^ expectedKey[i];
	}
	return diff === 0;
}

// ---------------------------------------------------------------------------
// bcrypt → PBKDF2 migration via Laravel proxy
// ---------------------------------------------------------------------------

async function verifyBcryptViaLaravel(hash: string, password: string): Promise<boolean> {
	const laravelUrl = env.LARAVEL_URL;
	const migrationSecret = env.MIGRATION_SECRET;

	if (!laravelUrl || !migrationSecret) {
		return false;
	}

	const [acctRow] = await db
		.select({ userId: account.userId })
		.from(account)
		.where(and(eq(account.providerId, 'credential'), eq(account.password, hash)));

	if (!acctRow) return false;

	const [userRow] = await db
		.select({ email: user.email })
		.from(user)
		.where(eq(user.id, acctRow.userId));

	if (!userRow) return false;

	try {
		const fetchUrl = `${laravelUrl}/api/verify-password`;

		const res = await fetch(fetchUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Migration-Secret': migrationSecret
			},
			body: JSON.stringify({ email: userRow.email, password })
		});

		const body = await res.text();

		if (!res.ok) return false;

		const { valid } = JSON.parse(body) as { valid: boolean };

		if (valid) {
			const newHash = await pbkdf2Hash(password);

			await db.update(account).set({ password: newHash }).where(eq(account.password, hash));
		}

		return valid;
	} catch {
		return false;
	}
}

// ---------------------------------------------------------------------------
// Auth instance (lazy-initialized)
// ---------------------------------------------------------------------------

type Auth = ReturnType<typeof createAuth>;
let _auth: Auth | undefined;

function createAuth() {
	const baseURL = env.ORIGIN;
	if (!baseURL) {
		throw new Error(
			'ORIGIN environment variable is required (used as better-auth baseURL). ' +
				'Set it to the deployment origin, e.g. https://corvmc.devon-cash.workers.dev'
		);
	}
	return betterAuth({
		baseURL,
		secret: env.BETTER_AUTH_SECRET,
		database: drizzleAdapter(db, {
			provider: 'sqlite',
			schema
		}),
		emailAndPassword: {
			enabled: true,
			password: {
				verify: async ({ hash, password }) => {
					if (hash.startsWith('$2')) {
						return verifyBcryptViaLaravel(hash, password);
					}
					if (hash.startsWith('pbkdf2:')) {
						return pbkdf2Verify(hash, password);
					}
					return false;
				},
				hash: pbkdf2Hash
			}
		},
		user: {
			additionalFields: {
				pronouns: { type: 'string', required: false },
				phone: { type: 'string', required: false },
				settings: { type: 'string', required: false },
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

export const auth = new Proxy({} as Auth, {
	get(_target, prop, receiver) {
		if (!_auth) _auth = createAuth();
		return Reflect.get(_auth, prop, receiver);
	}
});
