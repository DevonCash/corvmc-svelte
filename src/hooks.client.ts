import { handleErrorWithSentry, replayIntegration } from '@sentry/sveltekit';
import * as Sentry from '@sentry/sveltekit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/public';
import { SENTRY_DSN } from '$lib/sentry-dsn';

/**
 * Expected stale-deploy chunk failures: a tab opened before a deploy can't load
 * a route module whose immutable filename changed. The `vite:preloadError`
 * listener below reloads onto the fresh build, so these are recoverable noise,
 * not faults — drop them before they reach Sentry.
 */
function isStaleChunkError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error ?? '');
	return (
		message.includes('dynamically imported module') ||
		message.includes('Importing a module script failed')
	);
}

Sentry.init({
	beforeSend(event, hint) {
		if (isStaleChunkError(hint?.originalException)) return null;
		return event;
	},

	dsn: SENTRY_DSN,

	environment: env.PUBLIC_SENTRY_ENVIRONMENT ?? (dev ? 'development' : 'production'),

	// Don't report from local dev or the Playwright/preview e2e run (env set in playwright.config.ts)
	enabled: !dev && env.PUBLIC_SENTRY_ENVIRONMENT !== 'ci',

	tracesSampleRate: 1.0,

	// Enable logs to be sent to Sentry
	enableLogs: true,

	// This sets the sample rate to be 10%. You may want this to be 100% while
	// in development and sample at a lower rate in production
	replaysSessionSampleRate: 0.1,

	// If the entire session is not sampled, use the below sample rate to sample
	// sessions when an error occurs.
	replaysOnErrorSampleRate: 1.0,

	// If you don't want to use Session Replay, just remove the line below:
	integrations: [replayIntegration()],

	// Enable sending user PII (Personally Identifiable Information)
	// https://docs.sentry.io/platforms/javascript/guides/sveltekit/configuration/options/#sendDefaultPii
	sendDefaultPii: true
});

// A new deploy replaces the immutable chunk files, so a tab opened before the
// deploy fails to lazy-load a route module ("error loading dynamically imported
// module"). This is expected, not a bug — recover by reloading onto the new
// build. The timestamp guard suppresses a reload loop if the asset is genuinely
// gone (rapid repeat) while still allowing recovery from a later, separate deploy.
if (typeof window !== 'undefined') {
	window.addEventListener('vite:preloadError', () => {
		const key = 'preload-error-reloaded-at';
		const last = Number(sessionStorage.getItem(key) ?? 0);
		if (Date.now() - last < 10_000) return;
		sessionStorage.setItem(key, String(Date.now()));
		window.location.reload();
	});
}

// If you have a custom error handler, pass it to `handleErrorWithSentry`
export const handleError = handleErrorWithSentry();
