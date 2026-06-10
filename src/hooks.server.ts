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

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;

		if (!resolvedSessions.has(session.session.id)) {
			resolvedSessions.add(session.session.id);
			resolvePendingInvites(session.user.id, session.user.email).catch(captureException);
		}
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

// On Cloudflare Workers, Sentry must be initialised per-request via
// initCloudflareSentryHandle. The Node-style `Sentry.init()` in an
// instrumentation file pulls in Node/OpenTelemetry APIs the Workers runtime
// can't bundle, which broke the Cloudflare Pages deploy.
export const handle: Handle = sequence(
	Sentry.initCloudflareSentryHandle({
		dsn: SENTRY_DSN,
		environment: process.env.SENTRY_ENVIRONMENT ?? (dev ? 'development' : 'production'),
		// Don't report from local dev or the Playwright/preview e2e run (env set in playwright.config.ts)
		enabled: !dev && process.env.SENTRY_ENVIRONMENT !== 'ci',
		sendDefaultPii: true,
		tracesSampleRate: 1.0,
		enableLogs: true
	}),
	Sentry.sentryHandle(),
	handleBetterAuth
);

export const handleError: HandleServerError = Sentry.handleErrorWithSentry(
	async ({ error, event, status, message }) => {
		console.error(`[${status}] ${event.request.method} ${event.url.pathname}`, error);
		captureException(error);
		return { message };
	}
);
