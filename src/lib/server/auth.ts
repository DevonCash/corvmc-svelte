import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { createAuthMiddleware } from 'better-auth/api';
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { account } from '$lib/server/db/schema/authentication';
import { user } from '$lib/server/db/schema/authentication';
import { eq, and } from 'drizzle-orm';
import { captureException } from '$lib/server/sentry';
// ---------------------------------------------------------------------------
// PBKDF2 password hashing via Web Crypto API
// ---------------------------------------------------------------------------
// @noble/hashes scrypt is silently broken on Cloudflare Workers — it returns
// in 0ms with non-deterministic garbage. bcrypt-ts has the same issue.
// PBKDF2-SHA-256 via Web Crypto is natively supported on Workers.
// Format: "pbkdf2:iterations:salt_hex:key_hex"
//
// Cloudflare Workers' Web Crypto caps PBKDF2 at 100,000 iterations — anything
// higher throws `NotSupportedError: iteration counts above 100000 are not
// supported`, which silently broke every hash()/verify() call (and therefore
// all email/password sign-in). 100_000 is the maximum the runtime allows.
// ---------------------------------------------------------------------------

export const PBKDF2_ITERATIONS = 100_000;
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

export async function pbkdf2Hash(password: string): Promise<string> {
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

export async function pbkdf2Verify(hash: string, password: string): Promise<boolean> {
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
// scrypt password hashing via node:crypto (the default going forward)
// ---------------------------------------------------------------------------
// This is better-auth's own algorithm and parameters. On Cloudflare Workers the
// pure-JS @noble/hashes scrypt that better-auth falls back to is broken, but the
// `nodejs_compat` flag (see wrangler.toml) exposes the native node:crypto scrypt,
// which works and is far stronger than the 100k-iteration PBKDF2 ceiling Workers
// imposes on Web Crypto. node's default maxmem (32 MiB) is just under what these
// params need, so maxmem is raised to 64 MiB to match better-auth.
// Format: "scrypt:N:r:p:salt_hex:key_hex"
//
// NOTE: scrypt costs ~80ms of CPU per hash; this requires the Workers Paid plan
// (or Standard usage model). On the Free plan it exceeds the per-request CPU cap.
// ---------------------------------------------------------------------------

const SCRYPT_PARAMS = { N: 16384, r: 16, p: 1, keylen: 64, maxmem: 128 * 16384 * 16 * 2 };

function scryptDerive(password: string, salt: Buffer, p = SCRYPT_PARAMS): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		scrypt(
			password.normalize('NFKC'),
			salt,
			p.keylen,
			{ N: p.N, r: p.r, p: p.p, maxmem: p.maxmem },
			(err, derivedKey) => (err ? reject(err) : resolve(derivedKey))
		);
	});
}

export async function scryptHash(password: string): Promise<string> {
	const salt = randomBytes(16);
	const key = await scryptDerive(password, salt);
	const { N, r, p } = SCRYPT_PARAMS;
	return `scrypt:${N}:${r}:${p}:${salt.toString('hex')}:${key.toString('hex')}`;
}

export async function scryptVerify(hash: string, password: string): Promise<boolean> {
	const parts = hash.split(':');
	if (parts[0] !== 'scrypt' || parts.length !== 6) return false;
	const [, nStr, rStr, pStr, saltHex, keyHex] = parts;
	const expectedKey = Buffer.from(keyHex, 'hex');
	const derived = await scryptDerive(password, Buffer.from(saltHex, 'hex'), {
		N: parseInt(nStr, 10),
		r: parseInt(rStr, 10),
		p: parseInt(pStr, 10),
		keylen: expectedKey.length,
		maxmem: SCRYPT_PARAMS.maxmem
	});
	return derived.length === expectedKey.length && timingSafeEqual(derived, expectedKey);
}

// ---------------------------------------------------------------------------
// bcrypt → scrypt migration via Laravel proxy
// ---------------------------------------------------------------------------

async function verifyBcryptViaLaravel(hash: string, password: string): Promise<boolean> {
	const laravelUrl = env.LARAVEL_URL;
	const migrationSecret = env.MIGRATION_SECRET;

	if (!laravelUrl || !migrationSecret) {
		captureException(
			new Error(
				'bcrypt migration: a bcrypt hash needs migration but LARAVEL_URL/MIGRATION_SECRET are unset'
			),
			{
				event: 'auth.bcrypt_migration',
				stage: 'config_missing',
				hasLaravelUrl: Boolean(laravelUrl),
				hasMigrationSecret: Boolean(migrationSecret)
			}
		);
		return false;
	}

	const [acctRow] = await db
		.select({ userId: account.userId })
		.from(account)
		.where(and(eq(account.providerId, 'credential'), eq(account.password, hash)));

	if (!acctRow) {
		captureException(
			new Error('bcrypt migration: no credential account matches the supplied hash'),
			{ event: 'auth.bcrypt_migration', stage: 'account_not_found' }
		);
		return false;
	}

	const [userRow] = await db
		.select({ email: user.email })
		.from(user)
		.where(eq(user.id, acctRow.userId));

	if (!userRow) {
		captureException(new Error('bcrypt migration: credential account has no matching user'), {
			event: 'auth.bcrypt_migration',
			stage: 'user_not_found',
			userId: acctRow.userId
		});
		return false;
	}

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

		if (!res.ok) {
			captureException(
				new Error(`bcrypt migration: Laravel verify-password returned ${res.status}`),
				{
					event: 'auth.bcrypt_migration',
					stage: 'laravel_response',
					status: res.status,
					email: userRow.email
				}
			);
			return false;
		}

		const { valid } = JSON.parse(body) as { valid: boolean };

		if (valid) {
			const newHash = await scryptHash(password);

			await db.update(account).set({ password: newHash }).where(eq(account.password, hash));
		} else {
			// Laravel reached and authoritative, but rejected the credentials. This is
			// the one bcrypt path that previously failed silently — surface it so a
			// migration that rejects a known-good password is visible.
			captureException(
				new Error('bcrypt migration: Laravel verify-password rejected the credentials'),
				{
					event: 'auth.bcrypt_migration',
					stage: 'invalid_credentials',
					email: userRow.email
				}
			);
		}

		return valid;
	} catch (err) {
		captureException(err, {
			event: 'auth.bcrypt_migration',
			stage: 'request',
			email: userRow.email
		});
		return false;
	}
}

// ---------------------------------------------------------------------------
// Sign-in failure diagnostics
// ---------------------------------------------------------------------------
// better-auth's /sign-in/email throws the same generic INVALID_EMAIL_OR_PASSWORD
// for several structurally different failures, all before the `verify` callback
// runs. This before-hook does a read-only lookup and reports the *structural*
// anomalies (not ordinary wrong passwords) so they're distinguishable in Sentry.

export type SignInAnomaly =
	| 'user_not_found'
	| 'no_credential_account'
	| 'no_password'
	| 'unknown_hash_format';

/** Pure reason-derivation for a sign-in attempt; returns null when nothing is structurally wrong. */
export function deriveSignInAnomaly(input: {
	userFound: boolean;
	hasCredentialAccount: boolean;
	credentialPassword: string | null | undefined;
}): SignInAnomaly | null {
	if (!input.userFound) return 'user_not_found';
	if (!input.hasCredentialAccount) return 'no_credential_account';
	if (!input.credentialPassword) return 'no_password';
	const hash = input.credentialPassword;
	const known =
		hash.startsWith('scrypt:') || hash.startsWith('$2') || hash.startsWith('pbkdf2:');
	if (!known) return 'unknown_hash_format';
	return null;
}

async function reportSignInAnomaly(rawEmail: unknown): Promise<void> {
	if (typeof rawEmail !== 'string') return;
	const email = rawEmail.toLowerCase().trim();
	if (!email) return;

	const [userRow] = await db
		.select({ id: user.id, emailVerified: user.emailVerified })
		.from(user)
		.where(eq(user.email, email));

	const acctRow = userRow
		? (
				await db
					.select({ password: account.password })
					.from(account)
					.where(and(eq(account.userId, userRow.id), eq(account.providerId, 'credential')))
			)[0]
		: undefined;

	const reason = deriveSignInAnomaly({
		userFound: Boolean(userRow),
		hasCredentialAccount: Boolean(acctRow),
		credentialPassword: acctRow?.password
	});

	if (!reason) return;

	captureException(new Error(`auth.sign_in: ${reason}`), {
		event: 'auth.sign_in',
		stage: reason,
		email,
		emailVerified: userRow?.emailVerified ?? null,
		hasCredentialAccount: Boolean(acctRow),
		// prefix only — never log the full hash or the password
		hashPrefix: acctRow?.password ? acctRow.password.slice(0, 7) : null
	});
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
					if (hash.startsWith('scrypt:')) {
						return scryptVerify(hash, password);
					}
					if (hash.startsWith('$2')) {
						return verifyBcryptViaLaravel(hash, password);
					}
					// Legacy PBKDF2 hashes (written during the brief 100k-iteration
					// window before scrypt) still verify; they migrate to scrypt on
					// their owner's next successful bcrypt sign-in.
					if (hash.startsWith('pbkdf2:')) {
						return pbkdf2Verify(hash, password);
					}
					return false;
				},
				hash: scryptHash
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
		hooks: {
			before: createAuthMiddleware(async (ctx) => {
				if (ctx.path !== '/sign-in/email') return;
				try {
					await reportSignInAnomaly((ctx.body as { email?: unknown } | undefined)?.email);
				} catch (err) {
					// Diagnostics must never break the sign-in flow.
					captureException(err, { event: 'auth.sign_in', stage: 'diagnostic_error' });
				}
			})
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
