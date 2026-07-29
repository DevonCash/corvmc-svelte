// Sentry Crons check-ins over the plain HTTP check-in API. Used by the cron
// `scheduled` handler (worker.js) via runScheduledJobs, which runs OUTSIDE the
// SvelteKit build — no `$app`/`$env` imports here, and deliberately no Sentry
// SDK: the SDK client is initialized per-request in hooks.server.ts and does
// not exist when a scheduled invocation starts (and mixing @sentry/cloudflare
// with @sentry/sveltekit has bitten this repo before — see
// src/lib/server/sentry.ts).
//
// Docs: https://docs.sentry.io/product/crons/getting-started/http/
import { SENTRY_DSN } from '../../sentry-dsn';

export type CronCheckInStatus = 'in_progress' | 'ok' | 'error';

export type CronCheckIn = (opts: {
	slug: string;
	status: CronCheckInStatus;
	/** Cron expression; sent as monitor_config on in_progress to upsert the monitor. */
	cron?: string;
	/** Pairs a closing ok/error with its in_progress check-in. */
	checkInId?: string;
}) => Promise<string | undefined>;

/**
 * Build the check-in URL from the DSN:
 * https://<key>@<host>/<projectId> → https://<host>/api/<projectId>/cron/<slug>/<key>/
 */
function checkInUrl(slug: string): string {
	const dsn = new URL(SENTRY_DSN);
	const projectId = dsn.pathname.replace(/\//g, '');
	return `https://${dsn.host}/api/${projectId}/cron/${slug}/${dsn.username}/`;
}

/**
 * Returns a check-in reporter for the given Sentry environment. Sending
 * in_progress with a cron expression upserts the monitor (schedule changes in
 * wrangler.toml propagate on the next run — no dashboard setup). The reporter
 * never throws: monitoring must never break the jobs it watches.
 */
export function createSentryCheckIn(environment = 'production'): CronCheckIn {
	return async ({ slug, status, cron, checkInId }) => {
		try {
			const body: Record<string, unknown> = { status, environment };
			if (checkInId) body.check_in_id = checkInId;
			if (status === 'in_progress' && cron) {
				body.monitor_config = {
					schedule: { type: 'crontab', value: cron },
					timezone: 'Etc/UTC',
					// Late-start grace: daily-batch jobs start minutes after the hour
					// while earlier jobs in the batch run.
					checkin_margin: 10,
					// Workers cron invocations are wall-clock capped at 15 minutes.
					max_runtime: 15
				};
			}
			const response = await fetch(checkInUrl(slug), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body)
			});
			if (!response.ok) {
				console.warn(`[cron] Sentry check-in for ${slug} rejected with ${response.status}`);
				return undefined;
			}
			const data = (await response.json().catch(() => undefined)) as { id?: string } | undefined;
			return data?.id;
		} catch (err) {
			console.warn(`[cron] Sentry check-in for ${slug} failed:`, err);
			return undefined;
		}
	};
}
