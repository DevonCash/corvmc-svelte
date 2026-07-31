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
 * The retry is deliberately narrow. It fires only when BOTH hold:
 *
 * - The attempt THREW (dropped connection — the failure the retry exists for).
 *   A non-2xx response is Sentry answering; an identical immediate re-POST
 *   would just repeat a deterministic 4xx or land in the same rate-limit
 *   window, so those give up on the first answer.
 * - The check-in carries a `check_in_id`. With an id the retry is an
 *   idempotent update; without one it would CREATE a second check-in if the
 *   first POST actually landed and only its response was lost — with status
 *   `error`, double-counting against the monitor's failure threshold.
 */
const CLOSING_ATTEMPTS = 2;

/**
 * Bound each attempt: the check-ins are awaited on runScheduledJobs' critical
 * path, and a stalled connection to sentry.io must not eat the 15-minute
 * wall-clock budget the whole batch shares. Monitoring must never break the
 * jobs it watches — a lost check-in is recoverable, a starved job is not.
 */
const ATTEMPT_TIMEOUT_MS = 10_000;

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

		const payload = JSON.stringify(body);
		const attempts = status !== 'in_progress' && checkInId ? CLOSING_ATTEMPTS : 1;
		const failures: string[] = [];
		let lastThrown: unknown;

		for (let attempt = 1; attempt <= attempts; attempt++) {
			try {
				const response = await fetch(checkInUrl(slug), {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: payload,
					signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS)
				});
				if (!response.ok) {
					// Sentry answered — retrying an identical POST won't do better.
					failures.push(`rejected with ${response.status}`);
					break;
				}
				const data = (await response.json().catch(() => undefined)) as { id?: string } | undefined;
				return data?.id;
			} catch (err) {
				failures.push(String(err));
				lastThrown = err;
			}
		}

		// Warn once, after every attempt is spent, so a retried-then-recovered
		// check-in stays silent. Pass the thrown error object through so Workers
		// logs keep its stack and cause, not just the message.
		console.warn(
			`[cron] Sentry check-in for ${slug} failed: ${failures.join('; ')}`,
			...(lastThrown !== undefined ? [lastThrown] : [])
		);
		return undefined;
	};
}
