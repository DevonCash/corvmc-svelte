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
 * A closing check-in (ok/error) gets one retry; an opening one does not.
 *
 * The asymmetry is deliberate. If an `in_progress` never lands there is simply
 * no open check-in, and the job's own result is reported by the next run. But if
 * the `in_progress` lands and its closing check-in is dropped, the check-in stays
 * open until Sentry times it out at `max_runtime` and raises an outage — a
 * phantom alert for a job that actually succeeded. That is
 * JAVASCRIPT-SVELTEKIT-20: the other four jobs in the same 16:00 UTC batch
 * reported fine, so the invocation did not die; only the close went missing.
 *
 * One immediate retry, since the failure this covers is a dropped connection
 * rather than a busy server, and a scheduled invocation has a 15-minute
 * wall-clock budget to share across every job in the batch.
 */
const CLOSING_ATTEMPTS = 2;

/**
 * Returns a check-in reporter for the given Sentry environment. Sending
 * in_progress with a cron expression upserts the monitor (schedule changes in
 * wrangler.toml propagate on the next run — no dashboard setup). The reporter
 * never throws: monitoring must never break the jobs it watches.
 */
export function createSentryCheckIn(environment = 'production'): CronCheckIn {
	return async ({ slug, status, cron, checkInId }) => {
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

		const attempts = status === 'in_progress' ? 1 : CLOSING_ATTEMPTS;
		let lastFailure = '';

		for (let attempt = 1; attempt <= attempts; attempt++) {
			try {
				const response = await fetch(checkInUrl(slug), {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(body)
				});
				if (!response.ok) {
					lastFailure = `rejected with ${response.status}`;
					continue;
				}
				const data = (await response.json().catch(() => undefined)) as { id?: string } | undefined;
				return data?.id;
			} catch (err) {
				lastFailure = `failed: ${err}`;
			}
		}

		// Warn once, after every attempt is spent, so a retried-then-recovered
		// check-in stays silent and a genuine failure still shows up in the logs.
		console.warn(`[cron] Sentry check-in for ${slug} ${lastFailure}`);
		return undefined;
	};
}
