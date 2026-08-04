import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { wakeSnoozedThreads } from '$lib/server/inbox/thread-service';

/**
 * Cron endpoint for returning snoozed inbox threads to the open queue once their
 * snooze has elapsed. Without it a snooze is indistinguishable from deleting the
 * thread — the default list view only shows open conversations.
 *
 * Invoked every 15 minutes by the Worker's cron `scheduled` handler
 * (worker.js → src/lib/server/cron/schedule.ts); callable manually:
 *   POST /api/cron/wake-snoozed
 *   Authorization: Bearer <CRON_SECRET>
 */
export const POST: RequestHandler = async ({ request }) => {
	const secret = env.CRON_SECRET;
	if (!secret) throw error(500, 'CRON_SECRET not configured');

	const auth = request.headers.get('Authorization');
	if (auth !== `Bearer ${secret}`) {
		throw error(401, 'Unauthorized');
	}

	const result = await wakeSnoozedThreads();

	return json(result);
};
