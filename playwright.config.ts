import { defineConfig } from '@playwright/test';

export default defineConfig({
	// Seed the local D1 (member + payable reservation) before any test runs.
	globalSetup: './e2e/global-setup.ts',
	webServer: {
		command: 'npm run build && npm run preview',
		port: 4173,
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
			BETTER_AUTH_SECRET:
				process.env.BETTER_AUTH_SECRET ?? 'e2e-local-better-auth-secret-not-for-prod',
			STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? 'sk_test_dummy_e2e',
			STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_dummy_e2e'
		}
	},
	testMatch: '**/*.e2e.{ts,js}'
});
