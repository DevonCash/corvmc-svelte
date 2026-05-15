import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { generateRecurringReservations } from '$lib/server/reservation/generation-job';

/**
 * Cron endpoint for generating recurring reservation instances.
 * Runs daily (e.g., midnight Pacific). For each active recurring series
 * with prototype_type = 'reservation', expands the RRULE into concrete
 * reservations within the 2.5-week generation window.
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

	const result = await generateRecurringReservations();

	return json(result);
};
