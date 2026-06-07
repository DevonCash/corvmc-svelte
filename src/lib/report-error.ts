import * as Sentry from '@sentry/sveltekit';

/**
 * Expected, user-facing failures we don't want cluttering Sentry: 4xx responses
 * (bad input, auth, not-found, conflicts surfaced as HTTP errors). Genuine bugs
 * — 5xx, network failures, and thrown exceptions without an HTTP status — are
 * reported. Client-side form *validation* never reaches here; the `Form`
 * component handles that inline.
 */
function isExpected(err: unknown): boolean {
	if (!err || typeof err !== 'object') return false;
	const status = (err as { status?: unknown }).status;
	return typeof status === 'number' && status >= 400 && status < 500;
}

/**
 * Central client-side error sink. Logs everything to the console and forwards
 * genuine errors to Sentry. Call this from anywhere in the browser when you've
 * caught an error you want visibility on. On the server, use
 * `$lib/server/sentry`'s `captureException` instead.
 */
export function reportError(err: unknown, context?: Record<string, unknown>): void {
	console.error(err);
	if (isExpected(err)) return;
	Sentry.captureException(err, context ? { extra: context } : undefined);
}
