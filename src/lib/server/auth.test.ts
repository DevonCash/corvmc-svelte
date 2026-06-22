import { describe, it, expect, vi } from 'vitest';

// auth.ts pulls in db + sentry at import time; stub them so importing the
// module (for the pure reason-deriving helper) doesn't require a real DB.
vi.mock('$lib/server/db', () => ({ db: {} }));
vi.mock('$lib/server/sentry', () => ({ captureException: vi.fn() }));

import {
	buildVerifyPasswordUrl,
	deriveSignInAnomaly,
	pbkdf2Hash,
	pbkdf2Verify,
	PBKDF2_ITERATIONS,
	scryptHash,
	scryptVerify
} from './auth';

describe('scrypt password hashing (default)', () => {
	it('round-trips a hashed password', async () => {
		const hash = await scryptHash('correct horse battery staple');
		expect(hash.startsWith('scrypt:')).toBe(true);
		expect(await scryptVerify(hash, 'correct horse battery staple')).toBe(true);
		expect(await scryptVerify(hash, 'wrong password')).toBe(false);
	});

	it('rejects a malformed hash without throwing', async () => {
		expect(await scryptVerify('not-a-scrypt-hash', 'whatever')).toBe(false);
	});
});

describe('PBKDF2 password hashing', () => {
	// Cloudflare Workers' Web Crypto throws NotSupportedError for PBKDF2 iteration
	// counts above 100,000. The constant must stay at or below that ceiling or all
	// sign-in/sign-up hashing breaks in production (Node's Web Crypto has no such
	// cap, so this guard is the only thing that catches a regression locally).
	it('keeps iterations within the Cloudflare Workers limit', () => {
		expect(PBKDF2_ITERATIONS).toBeLessThanOrEqual(100_000);
	});

	it('round-trips a hashed password', async () => {
		const hash = await pbkdf2Hash('correct horse battery staple');
		expect(hash.startsWith(`pbkdf2:${PBKDF2_ITERATIONS}:`)).toBe(true);
		expect(await pbkdf2Verify(hash, 'correct horse battery staple')).toBe(true);
		expect(await pbkdf2Verify(hash, 'wrong password')).toBe(false);
	});
});

describe('buildVerifyPasswordUrl', () => {
	// Production LARAVEL_URL carried a trailing slash, which turned the verify
	// endpoint into `…//api/verify-password`. Laravel 404s the double slash, so
	// every un-migrated bcrypt user got "Invalid email or password." on sign-in.
	it('strips a trailing slash so the path has no double slash', () => {
		expect(buildVerifyPasswordUrl('https://example.test/')).toBe(
			'https://example.test/api/verify-password'
		);
	});

	it('strips multiple trailing slashes', () => {
		expect(buildVerifyPasswordUrl('https://example.test///')).toBe(
			'https://example.test/api/verify-password'
		);
	});

	it('leaves a slash-free base unchanged', () => {
		expect(buildVerifyPasswordUrl('https://example.test')).toBe(
			'https://example.test/api/verify-password'
		);
	});
});

describe('deriveSignInAnomaly', () => {
	it('flags a missing user', () => {
		expect(
			deriveSignInAnomaly({
				userFound: false,
				hasCredentialAccount: false,
				credentialPassword: null
			})
		).toBe('user_not_found');
	});

	it('flags a user with no credential account', () => {
		expect(
			deriveSignInAnomaly({
				userFound: true,
				hasCredentialAccount: false,
				credentialPassword: null
			})
		).toBe('no_credential_account');
	});

	it('flags a credential account with an empty password', () => {
		expect(
			deriveSignInAnomaly({ userFound: true, hasCredentialAccount: true, credentialPassword: '' })
		).toBe('no_password');
	});

	it('flags a password stored in an unrecognized hash format', () => {
		expect(
			deriveSignInAnomaly({
				userFound: true,
				hasCredentialAccount: true,
				credentialPassword: 'plaintext-or-md5-garbage'
			})
		).toBe('unknown_hash_format');
	});

	it('returns null for a recognized bcrypt hash (verify handles correctness)', () => {
		expect(
			deriveSignInAnomaly({
				userFound: true,
				hasCredentialAccount: true,
				credentialPassword: '$2y$12$' + 'x'.repeat(53)
			})
		).toBeNull();
	});

	it('returns null for a recognized pbkdf2 hash', () => {
		expect(
			deriveSignInAnomaly({
				userFound: true,
				hasCredentialAccount: true,
				credentialPassword: 'pbkdf2:600000:abcd:ef01'
			})
		).toBeNull();
	});
});
