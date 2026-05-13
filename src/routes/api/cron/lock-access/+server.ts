import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { runDailyLockJob } from '$lib/server/lock/lock-service';

/**
 * Cron endpoint for daily lock access provisioning and cleanup.
 * Protected by a shared secret in the Authorization header.
 *
 * Call from an external scheduler (e.g., cron-job.org, Railway cron):
 *   POST /api/cron/lock-access
 *   Authorization: Bearer <CRON_SECRET>
 */
export const POST: RequestHandler = async ({ request }) => {
	const secret = env.CRON_SECRET;
	if (!secret) throw error(500, 'CRON_SECRET not configured');

	const auth = request.headers.get('Authorization');
	if (auth !== `Bearer ${secret}`) {
		throw error(401, 'Unauthorized');
	}

	const result = await runDailyLockJob();

	return json({
		provisioned: result.provisioned,
		cleaned: result.cleaned,
		errors: result.errors
	});
};
