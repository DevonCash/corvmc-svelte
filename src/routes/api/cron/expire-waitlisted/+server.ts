import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { expireWaitlisted } from '$lib/server/reservation/waitlist-service';

/**
 * Cron endpoint for expiring waitlisted reservations past their 24h window.
 * Runs every 15 minutes. Cancelled waitlisted reservations cascade promotion
 * to the next person in line.
 *
 * Call from an external scheduler:
 *   POST /api/cron/expire-waitlisted
 *   Authorization: Bearer <CRON_SECRET>
 */
export const POST: RequestHandler = async ({ request }) => {
	const secret = env.CRON_SECRET;
	if (!secret) throw error(500, 'CRON_SECRET not configured');

	const auth = request.headers.get('Authorization');
	if (auth !== `Bearer ${secret}`) {
		throw error(401, 'Unauthorized');
	}

	const result = await expireWaitlisted();

	return json(result);
};
