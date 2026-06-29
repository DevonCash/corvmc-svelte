import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { generateRecurring } from '$lib/server/reservation/generation-job';

/**
 * Cron endpoint for generating recurring instances.
 * Runs daily (e.g., midnight Pacific). Expands active recurring series into
 * concrete rows within the 2.5-week generation window — events first (so their
 * space reservations are in place), then reservations.
 *
 * Call from an external scheduler:
 *   POST /api/cron/generate-recurring-reservations
 *   Authorization: Bearer <CRON_SECRET>
 */
export const POST: RequestHandler = async ({ request }) => {
	const secret = env.CRON_SECRET;
	if (!secret) throw error(500, 'CRON_SECRET not configured');

	const auth = request.headers.get('Authorization');
	if (auth !== `Bearer ${secret}`) {
		throw error(401, 'Unauthorized');
	}

	const result = await generateRecurring();

	return json(result);
};
