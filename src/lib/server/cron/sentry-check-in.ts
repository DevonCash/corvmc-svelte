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
	/** Pairs a closing ok/error with its in_progress check-in. Generated if absent. */
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
 * Every check-in carries a client-generated `check_in_id`, so each attempt is an
 * idempotent update rather than a create, and one retry is always safe.
 *
 * This replaces an earlier asymmetry (retry the close, never the open) that
 * fixed JAVASCRIPT-SVELTEKIT-20 and caused JAVASCRIPT-SVELTEKIT-21. Reading the
 * id out of the opening RESPONSE meant a slow, aborted, or unparseable response
 * lost it — even though Sentry had already recorded the open check-in. The close
 * then went out with no id, which CREATES a second check-in instead of closing
 * the first, leaving the original to time out at `max_runtime` and raise a
 * phantom outage for a job that ran fine.
 *
 * Generating the id up front (Sentry's HTTP API accepts a client-supplied
 * `check_in_id`) makes the opening response irrelevant: the close always targets
 * the check-in the open created.
 *
 * The retry still fires only when the attempt THREW — a dropped connection, the
 * failure it exists for. A non-2xx is Sentry answering, and an identical
 * immediate re-POST would repeat a deterministic 4xx or land in the same
 * rate-limit window.
 */
const ATTEMPTS = 2;

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
		// Client-generated so the id survives a lost opening response.
		const id = checkInId ?? crypto.randomUUID();
		const body: Record<string, unknown> = { status, environment, check_in_id: id };
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
		const failures: string[] = [];
		let lastThrown: unknown;

		for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
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
				// The response body is not consulted: the id is ours already, and
				// depending on reading it back is exactly what broke before.
				return id;
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
		// Still hand back the id. If the open actually landed and only its response
		// was lost, the close must target it; a fresh id would orphan it.
		return id;
	};
}
