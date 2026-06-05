import { describe, it, expect, vi } from 'vitest';

// auth.ts pulls in db + sentry at import time; stub them so importing the
// module (for the pure reason-deriving helper) doesn't require a real DB.
vi.mock('$lib/server/db', () => ({ db: {} }));
vi.mock('$lib/server/sentry', () => ({ captureException: vi.fn() }));

import { deriveSignInAnomaly } from './auth';

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
