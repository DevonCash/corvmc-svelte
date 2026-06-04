import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: {
		command: 'npm run build && npm run preview',
		port: 4173,
		env: { SENTRY_ENVIRONMENT: 'ci', PUBLIC_SENTRY_ENVIRONMENT: 'ci' }
	},
	testMatch: '**/*.e2e.{ts,js}'
});
