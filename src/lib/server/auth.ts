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
import { kv } from '$lib/server/kv';

// ---------------------------------------------------------------------------
// Debug logging — writes to KV so it persists across Worker isolates.
// Read via: /api/debug-auth?secret=...&action=logs
// Remove after password migration is complete.
// ---------------------------------------------------------------------------
async function logAuth(msg: string) {
	console.log(msg);
	try {
		const existing = await kv().get('auth-debug-log');
		const logs: string[] = existing ? JSON.parse(existing) : [];
		logs.push(`${new Date().toISOString()} ${msg}`);
		if (logs.length > 30) logs.splice(0, logs.length - 30);
		await kv().put('auth-debug-log', JSON.stringify(logs), { expirationTtl: 3600 });
	} catch {
		// best effort
	}
}

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

function hexEncode(buf: ArrayBuffer): string {
	return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexDecode(hex: string): Uint8Array {
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

	await logAuth(`[step 1] verify called. hash_prefix=${hash.substring(0, 15)} pw_len=${password.length}`);
	await logAuth(`[step 2] env: LARAVEL_URL=${laravelUrl ?? 'NOT SET'} MIGRATION_SECRET=${migrationSecret ? 'set' : 'NOT SET'}`);

	if (!laravelUrl || !migrationSecret) {
		await logAuth('[step 2] ABORT: missing env vars');
		return false;
	}

	const [acctRow] = await db
		.select({ userId: account.userId })
		.from(account)
		.where(and(eq(account.providerId, 'credential'), eq(account.password, hash)));

	await logAuth(`[step 3] account lookup: ${acctRow ? 'found userId=' + acctRow.userId : 'NOT FOUND'}`);

	if (!acctRow) return false;

	const [userRow] = await db
		.select({ email: user.email })
		.from(user)
		.where(eq(user.id, acctRow.userId));

	await logAuth(`[step 4] user lookup: ${userRow ? 'found email=' + userRow.email : 'NOT FOUND'}`);

	if (!userRow) return false;

	try {
		const fetchUrl = `${laravelUrl}/api/verify-password`;
		await logAuth(`[step 5] calling Laravel: ${fetchUrl}`);

		const res = await fetch(fetchUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Migration-Secret': migrationSecret
			},
			body: JSON.stringify({ email: userRow.email, password })
		});

		const body = await res.text();
		await logAuth(`[step 6] Laravel response: status=${res.status} body=${body.substring(0, 200)}`);

		if (!res.ok) return false;

		const { valid } = JSON.parse(body) as { valid: boolean };
		await logAuth(`[step 7] Laravel says valid=${valid}`);

		if (valid) {
			const newHash = await pbkdf2Hash(password);
			await logAuth(`[step 8] PBKDF2 hash created: len=${newHash.length} prefix=${newHash.substring(0, 20)}`);

			await db
				.update(account)
				.set({ password: newHash })
				.where(eq(account.password, hash));
			await logAuth(`[step 9] hash saved to D1`);
		}

		return valid;
	} catch (err) {
		await logAuth(`[ERROR] fetch failed: ${err}`);
		return false;
	}
}

// ---------------------------------------------------------------------------
// Auth instance (lazy-initialized)
// ---------------------------------------------------------------------------

let _auth: ReturnType<typeof betterAuth> | undefined;

function createAuth() {
	return betterAuth({
		baseURL: env.ORIGIN || undefined,
		secret: env.BETTER_AUTH_SECRET,
		database: drizzleAdapter(db, {
			provider: 'sqlite',
			schema,
			experimental: { joins: true }
		}),
		emailAndPassword: {
			enabled: true,
			password: {
				verify: async ({ hash, password }) => {
					await logAuth(`[verify] called: hash_type=${hash.startsWith('$2') ? 'bcrypt' : hash.startsWith('pbkdf2:') ? 'pbkdf2' : 'unknown'} hash_len=${hash.length}`);

					if (hash.startsWith('$2')) {
						return verifyBcryptViaLaravel(hash, password);
					}
					if (hash.startsWith('pbkdf2:')) {
						const result = await pbkdf2Verify(hash, password);
						await logAuth(`[verify] pbkdf2 result=${result}`);
						return result;
					}
					await logAuth(`[verify] unrecognized hash format`);
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

export const auth = new Proxy({} as ReturnType<typeof betterAuth>, {
	get(_target, prop, receiver) {
		if (!_auth) _auth = createAuth();
		return Reflect.get(_auth, prop, receiver);
	}
});
