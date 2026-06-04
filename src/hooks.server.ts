import { sequence } from '@sveltejs/kit/hooks';
import * as Sentry from '@sentry/sveltekit';
import type { Handle, HandleServerError } from '@sveltejs/kit';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { registerListeners } from '$lib/server/events/register-listeners';
import { initDb } from '$lib/server/db';
import { initStorage } from '$lib/server/storage';
import { initKv } from '$lib/server/kv';
import { resolvePendingInvites } from '$lib/server/band/platform-invite-service';
import { captureException } from '$lib/server/sentry';

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

export const handle: Handle = sequence(Sentry.sentryHandle(), handleBetterAuth);

export const handleError: HandleServerError = Sentry.handleErrorWithSentry(
	async ({ error, event, status, message }) => {
		console.error(`[${status}] ${event.request.method} ${event.url.pathname}`, error);
		captureException(error);
		return { message };
	}
);
