import { sequence } from '@sveltejs/kit/hooks';
import * as Sentry from '@sentry/sveltekit';
import type { Handle, HandleServerError } from '@sveltejs/kit';
import { building, dev } from '$app/environment';
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { registerListeners } from '$lib/server/events/register-listeners';
import { initDb } from '$lib/server/db';
import { initStorage } from '$lib/server/storage';
import { initKv } from '$lib/server/kv';
import { resolvePendingInvites } from '$lib/server/band/platform-invite-service';
import { captureException } from '$lib/server/sentry';
import { SENTRY_DSN } from '$lib/sentry-dsn';
import { isLocalOrigin } from '$lib/sentry-local-origin';
import { env as publicEnv } from '$env/dynamic/public';
import { bandSlugFromHost } from '$lib/utils/band-site-url';
import { resolveBandSubdomain } from '$lib/server/band/band-host-service';
import { isFeatureEnabled } from '$lib/server/feature-flags';

const resolvedSessions = new Set<string>();

function validateEnv(platform: App.Platform | undefined) {
	const missing: string[] = [];
	if (!platform?.env?.DB) missing.push('DB');
	if (!platform?.env?.R2_BUCKET) missing.push('R2_BUCKET');
	if (!platform?.env?.KV) missing.push('KV');
	if (missing.length > 0) {
		console.warn(`Missing platform bindings: ${missing.join(', ')}`);
	}
}

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	if (event.platform?.env?.DB) {
		initDb(event.platform.env.DB);
	}
	if (event.platform?.env?.R2_BUCKET) {
		initStorage(event.platform.env.R2_BUCKET);
	}
	if (event.platform?.env?.KV) {
		initKv(event.platform.env.KV);
	}

	// Register domain event listeners once (inside request handler so
	// $env/dynamic/private is available on Cloudflare)
	if (!building) {
		validateEnv(event.platform);
		registerListeners();
	}
	const session = await auth.api.getSession({ headers: event.request.headers });

	// Deactivated users (soft-deleted, `deletedAt` set) are treated as anonymous.
	// The session row is left intact in the DB; it's inert because every request
	// re-resolves through this gate. Layout auth gates then redirect to login.
	if (session && !session.user.deletedAt) {
		event.locals.session = session.session;
		event.locals.user = session.user;

		if (!resolvedSessions.has(session.session.id)) {
			resolvedSessions.add(session.session.id);
			resolvePendingInvites(session.user.id, session.user.email).catch(captureException);
		}
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

/**
 * Every band has `{slug}.corvmc.org`, but only premium bands have a microsite
 * to serve there. For everyone else the subdomain is an alias for their
 * directory profile, so the address a band hands out always resolves to
 * something about that band — free or not.
 *
 * This lives here rather than in `reroute` because the decision needs the
 * database, and `reroute` is a universal hook that also runs in the browser.
 * `reroute` has already mapped the request to /band-site/{slug} by this point;
 * all that is left is to decide whether to let it through.
 *
 * A band whose `directoryVisibility` is not public redirects to a profile that
 * 404s. That is deliberate: visibility is enforced once, in
 * `getPublicBandProfile`, instead of being duplicated per host.
 */
const handleBandSubdomain: Handle = async ({ event, resolve }) => {
	const slug = bandSlugFromHost(event.url.hostname, publicEnv.PUBLIC_SITE_URL);
	if (!slug) return resolve(event);

	const [host, premiumEnabled] = await Promise.all([
		resolveBandSubdomain(slug),
		isFeatureEnabled('bandPremium')
	]);

	if (host?.servesSite && premiumEnabled) return resolve(event);

	// Free tier, unknown slug, or the feature switched off — send them to the
	// profile. Band-site subpaths (/events, /epk) have no directory equivalent,
	// so everything lands on the profile itself.
	const siteUrl = publicEnv.PUBLIC_SITE_URL || 'https://corvmc.org';
	return new Response(null, {
		status: 302,
		headers: { location: new URL(`/directory/bands/${slug}`, siteUrl).href }
	});
};

// Bot/proxy clients probe paths we don't serve (e.g. /.well-known/traffic-advice),
// each producing a SvelteKit "Not found: <path>" 404. These aren't our bugs and
// drowned out real issues, so drop them before they reach Sentry. The matching
// 4xx guard in `handleError` covers our explicit captures; this catches anything
// captured by the request handler itself.
function isNotFoundError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error ?? '');
	return message.startsWith('Not found:');
}

// A local dev/preview server must never report to production Sentry. The
// primary gate is `enabled` below, which checks ORIGIN — that also silences
// transactions and logs, which never pass through beforeSend. This per-event
// check is the backstop for request-scoped events when ORIGIN looks
// production-like but the request URL says otherwise. Events with no request
// context fail open here (better a stray event than a dropped production
// error); the ORIGIN gate is what actually covers them.
export function isLocalOriginEvent(event: { request?: { url?: string } }): boolean {
	return isLocalOrigin(event.request?.url);
}

// On Cloudflare Workers, Sentry must be initialised per-request via
// initCloudflareSentryHandle. The Node-style `Sentry.init()` in an
// instrumentation file pulls in Node/OpenTelemetry APIs the Workers runtime
// can't bundle, which broke the Cloudflare Pages deploy.
export const handle: Handle = sequence(
	Sentry.initCloudflareSentryHandle({
		dsn: SENTRY_DSN,
		environment: process.env.SENTRY_ENVIRONMENT ?? (dev ? 'development' : 'production'),
		// Don't report from local dev or the Playwright/preview e2e run (env set in
		// playwright.config.ts). The env-var gate fails open when a preview server
		// is reused or hand-started outside Playwright, so also check ORIGIN, which
		// every local server has set (the preview refuses to boot without it) —
		// this silences transactions and logs too, which beforeSend never sees, and
		// covers request-less events (uncaught exceptions from background work)
		// that carry no URL to check. In production Workers, ORIGIN is either the
		// real domain or absent from process.env — isLocalOrigin fails open on
		// both, so reporting stays enabled.
		enabled: !dev && process.env.SENTRY_ENVIRONMENT !== 'ci' && !isLocalOrigin(process.env.ORIGIN),
		beforeSend(event, hint) {
			if (isLocalOriginEvent(event)) return null;
			if (isNotFoundError(hint?.originalException)) return null;
			return event;
		},
		sendDefaultPii: true,
		tracesSampleRate: 1.0,
		enableLogs: true
	}),
	Sentry.sentryHandle(),
	// Must come after handleBetterAuth: that is where initDb() runs, and the
	// subdomain gate queries the band table.
	handleBetterAuth,
	handleBandSubdomain
);

export const handleError: HandleServerError = Sentry.handleErrorWithSentry(
	async ({ error, event, status, message }) => {
		console.error(`[${status}] ${event.request.method} ${event.url.pathname}`, error);
		// 4xx are client errors, not our bugs — mostly bot/proxy probes for paths we
		// don't serve (e.g. /.well-known/traffic-advice). Only report genuine 5xx.
		if (status >= 500) captureException(error);
		return { message };
	}
);
