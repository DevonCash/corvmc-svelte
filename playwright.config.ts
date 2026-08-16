import { defineConfig } from '@playwright/test';

export default defineConfig({
	// Seed the local D1 (member + payable reservation) before any test runs.
	globalSetup: './e2e/global-setup.ts',
	/**
	 * One worker, because every test shares one database.
	 *
	 * Playwright defaults to half the CPU count — two on a GitHub runner — and
	 * both workers drive the *same* preview server over the *same* local D1.
	 * Concurrent writes to one SQLite file give `SQLITE_BUSY_SNAPSHOT`, which is
	 * exactly what it says: a transaction tried to upgrade to a write after
	 * another connection had already written since its read snapshot began.
	 *
	 * workerd reports that as `SENTRY_DO SQLite failed; NOSENTRY database is
	 * locked`, D1 then answers `Failed to parse body as JSON, got: Error:
	 * internal error`, and unrelated requests 500 for a few seconds. The test
	 * Playwright blames is whichever one happened to be mid-flight, never the one
	 * that caused it — three runs on one commit blamed three different specs.
	 *
	 * There is no busy-timeout knob to turn: D1 under miniflare is workerd's own
	 * SQLite, so the only lever is to stop writing to it from two places at once.
	 * Costs roughly double the wall clock, which is the right trade for a suite
	 * that was failing about half the time.
	 */
	workers: 1,
	webServer: {
		command: 'npm run build && npm run preview',
		port: 4173,
		// The command builds before it serves, and a cold production build here
		// takes several minutes — well past the 60s default, which reported the
		// timeout as a server failure rather than a slow build.
		timeout: 600_000,
		// Reuse a preview already running locally to avoid a full rebuild each run.
		reuseExistingServer: !process.env.CI,
		env: {
			SENTRY_ENVIRONMENT: 'ci',
			PUBLIC_SENTRY_ENVIRONMENT: 'ci',
			// $env/dynamic/private reads process.env under `vite preview`, so the
			// secrets that .dev.vars provides to the seed must also be passed here or
			// the preview server throws ("ORIGIN environment variable is required").
			// Real values can override these via the shell environment.
			ORIGIN: process.env.ORIGIN ?? 'http://localhost:4173',
			// Band addresses hang off this domain, so the subdomain tests need it to
			// be `localhost` — without it the app falls back to corvmc.org and
			// {slug}.localhost:4173 is not recognised as a band address at all.
			PUBLIC_SITE_URL: process.env.PUBLIC_SITE_URL ?? 'http://localhost:4173',
			BETTER_AUTH_SECRET:
				process.env.BETTER_AUTH_SECRET ?? 'e2e-local-better-auth-secret-not-for-prod',
			STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? 'sk_test_dummy_e2e',
			STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_dummy_e2e'
		}
	},
	testMatch: '**/*.e2e.{ts,js}'
});
