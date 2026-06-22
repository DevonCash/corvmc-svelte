// Import from `@sentry/sveltekit` — the same package whose
// `initCloudflareSentryHandle` registers the client in hooks.server.ts. Pulling
// these from `@sentry/cloudflare` resolved a different (version-skewed)
// `@sentry/core` instance with its own client carrier, so `isInitialized()`
// always read `false` here and every server capture fell through to
// `console.error` instead of reaching Sentry.
import { captureException as sentryCaptureException, isInitialized } from '@sentry/sveltekit';

export function captureException(err: unknown, context?: Record<string, unknown>) {
	if (!isInitialized()) {
		console.error(err);
		return;
	}
	sentryCaptureException(err, context ? { extra: context } : undefined);
}
