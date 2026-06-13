import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { checkEmailService } from '$lib/server/notification/email';
import { captureException } from '$lib/server/sentry';

/**
 * Cron endpoint that verifies the Postmark integration is alive WITHOUT
 * sending an email. Calls Postmark's server endpoint (valid token + active
 * account => 200) and reports failures to Sentry so a silent email outage
 * pages us instead of surfacing as a member complaint.
 *
 * Schedule: daily (any cadence works — this is a config/liveness probe)
 *   POST /api/cron/email-heartbeat
 *   Authorization: Bearer <CRON_SECRET>
 */
export const POST: RequestHandler = async ({ request }) => {
	const secret = env.CRON_SECRET;
	if (!secret) throw error(500, 'CRON_SECRET not configured');

	const auth = request.headers.get('Authorization');
	if (auth !== `Bearer ${secret}`) {
		throw error(401, 'Unauthorized');
	}

	const health = await checkEmailService();

	if (!health.ok) {
		captureException(new Error(`email heartbeat failed: ${health.reason}`), {
			event: 'email.heartbeat',
			reason: health.reason,
			error: health.error,
			missingTemplates: health.missingTemplates
		});
		// 503 so an external monitor watching the HTTP status also notices.
		throw error(503, `Email service unhealthy: ${health.reason}`);
	}

	return json({ ok: true, serverName: health.serverName });
};
