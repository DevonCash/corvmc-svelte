import { handleErrorWithSentry, replayIntegration } from '@sentry/sveltekit';
import * as Sentry from '@sentry/sveltekit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/public';
import { SENTRY_DSN } from '$lib/sentry-dsn';
import { isLocalOrigin } from '$lib/sentry-local-origin';

/**
 * Expected stale-deploy chunk failures: a tab opened before a deploy can't load
 * a route module whose immutable filename changed. The `vite:preloadError`
 * listener below reloads onto the fresh build, so these are recoverable noise,
 * not faults — drop them before they reach Sentry.
 */
export function isStaleChunkError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error ?? '');
	return (
		message.includes('dynamically imported module') ||
		message.includes('Importing a module script failed')
	);
}

/**
 * Fetch aborted by the browser, usually because the user navigated away mid-request
 * or briefly lost connectivity. Not actionable and not our bug — drop it.
 */
export function isNetworkAbortError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error ?? '');
	return (
		message.includes('NetworkError when attempting to fetch resource') ||
		message.includes('Failed to fetch') ||
		message.includes('Load failed')
	);
}

/**
 * In-app webviews (Instagram, Facebook, …) inject their own native-bridge
 * scripts into every page; when those crash — e.g. reading
 * `window.webkit.messageHandlers` outside the host app — the error is
 * attributed to our document URL even though none of our code is involved
 * (JAVASCRIPT-SVELTEKIT-1F). We never reference the webkit bridge, so drop
 * anything mentioning it or thrown from the bridge's known entry points.
 */
const WEBVIEW_BRIDGE_FUNCTIONS = ['sendDataToNative', 'sendPageHideMessage'];

export function isWebviewBridgeError(event: Sentry.ErrorEvent, error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error ?? '');
	if (message.includes('window.webkit.messageHandlers')) return true;
	// Sentry stacktraces are ordered caller → callee, so the crashing frame is last.
	const frames = event.exception?.values?.[0]?.stacktrace?.frames;
	const top = frames?.[frames.length - 1];
	return Boolean(top?.function && WEBVIEW_BRIDGE_FUNCTIONS.includes(top.function));
}

/**
 * A local dev/preview server must never report to production Sentry. The
 * `enabled` flag below already gates on PUBLIC_SENTRY_ENVIRONMENT, but that env
 * var is only set when Playwright starts the preview server itself — a reused or
 * hand-started one on :4173 slips through. See $lib/sentry-local-origin.
 */
export function isLocalOriginEvent(event: Sentry.ErrorEvent): boolean {
	return isLocalOrigin(event.request?.url ?? globalThis.location?.href);
}

Sentry.init({
	beforeSend(event, hint) {
		if (isLocalOriginEvent(event)) return null;
		if (isStaleChunkError(hint?.originalException)) return null;
		if (isNetworkAbortError(hint?.originalException)) return null;
		if (isWebviewBridgeError(event, hint?.originalException)) return null;
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
