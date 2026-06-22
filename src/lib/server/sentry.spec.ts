import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Regression: server-side Sentry diagnostics were silently dropped because the
// wrapper resolved `isInitialized`/`captureException` from `@sentry/cloudflare`
// (a different installed version → a different `@sentry/core` instance → a
// different global client carrier) than the `@sentry/sveltekit`
// `initCloudflareSentryHandle` that actually registered the client. The guard
// initialised one carrier; the wrapper read the other and always saw `false`,
// so every capture fell through to `console.error`.
// ---------------------------------------------------------------------------

// Mock the SDK the wrapper SHOULD share with the init site (hooks.server.ts).
const isInitialized = vi.fn<() => boolean>();
const captureException = vi.fn();
vi.mock('@sentry/sveltekit', () => ({
	isInitialized: () => isInitialized(),
	captureException: (...args: unknown[]) => captureException(...args)
}));

describe('captureException wrapper', () => {
	beforeEach(() => {
		vi.resetModules();
		isInitialized.mockReset();
		captureException.mockReset();
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('forwards to the same SDK instance that init registered the client on', async () => {
		isInitialized.mockReturnValue(true);
		const { captureException: wrapped } = await import('./sentry');
		const err = new Error('auth.sign_in: no_credential_account');

		wrapped(err, { stage: 'no_credential_account' });

		expect(captureException).toHaveBeenCalledWith(err, {
			extra: { stage: 'no_credential_account' }
		});
	});

	it('does not forward when the client is uninitialized', async () => {
		isInitialized.mockReturnValue(false);
		const { captureException: wrapped } = await import('./sentry');

		wrapped(new Error('boom'));

		expect(captureException).not.toHaveBeenCalled();
	});
});

describe('Sentry import alignment', () => {
	it('imports the wrapper SDK from the same package as the init site', () => {
		const root = process.cwd();
		const wrapperSrc = readFileSync(resolve(root, 'src/lib/server/sentry.ts'), 'utf8');
		const hooksSrc = readFileSync(resolve(root, 'src/hooks.server.ts'), 'utf8');

		// The init lives in hooks.server.ts via `@sentry/sveltekit`. The capture
		// wrapper must resolve from the exact same package so they share a client
		// carrier — importing from `@sentry/cloudflare` reintroduces the skew bug.
		expect(hooksSrc).toMatch(/from '@sentry\/sveltekit'/);
		expect(wrapperSrc).toMatch(/from '@sentry\/sveltekit'/);
		expect(wrapperSrc).not.toMatch(/from '@sentry\/cloudflare'/);
	});
});
