import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { registerListeners } from '$lib/server/events/register-listeners';
import { initDb } from '$lib/server/db';
import { initStorage } from '$lib/server/storage';
import { resolvePendingInvites } from '$lib/server/band/platform-invite-service';

// Register domain event listeners once at startup
if (!building) {
	registerListeners();
}

const resolvedSessions = new Set<string>();

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	if (event.platform?.env?.DB) {
		initDb(event.platform.env.DB);
	}
	if (event.platform?.env?.R2_BUCKET) {
		initStorage(event.platform.env.R2_BUCKET);
	}

	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;

		if (!resolvedSessions.has(session.session.id)) {
			resolvedSessions.add(session.session.id);
			resolvePendingInvites(session.user.id, session.user.email).catch(console.error);
		}
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = handleBetterAuth;
