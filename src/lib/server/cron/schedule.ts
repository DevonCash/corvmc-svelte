// Cron dispatch map + runner for the `scheduled` handler in worker.js (the
// wrangler `main` entry). Bundled by wrangler's esbuild OUTSIDE the SvelteKit
// build, so this module must not import `$app`/`$env` or anything else that
// only resolves inside the kit build.
import type { CronCheckIn } from './sentry-check-in';

/**
 * Cron expression → ordered list of /api/cron/* endpoints to run, sequentially,
 * when that trigger fires. Must stay in sync with `[triggers]` in wrangler.toml.
 *
 * The daily batch order is deliberate: generation runs first so freshly
 * generated occurrences are visible to lock provisioning and the reminders.
 */
export const CRON_SCHEDULE: Record<string, string[]> = {
	'*/5 * * * *': ['/api/cron/send-campaigns'],
	'*/15 * * * *': [
		'/api/cron/auto-complete',
		'/api/cron/cancel-unconfirmed',
		'/api/cron/expire-waitlisted',
		'/api/cron/wake-snoozed'
	],
	'0 16 * * *': [
		'/api/cron/generate-recurring-reservations',
		'/api/cron/lock-access',
		'/api/cron/confirmation-reminders',
		'/api/cron/reservation-reminders',
		'/api/cron/cancel-stale-tickets'
	]
};

export interface CronEnv {
	ORIGIN: string;
	CRON_SECRET?: string;
	/** Sentry Crons monitor environment; defaults to 'production' in the reporter. */
	SENTRY_ENVIRONMENT?: string;
}

export interface CronJobResult {
	path: string;
	ok: boolean;
	status?: number;
	error?: string;
}

/**
 * Run every job mapped to `cron`, in order, by POSTing to the endpoint through
 * `fetcher` (in production: the generated worker's own `fetch` export — an
 * in-process call, not a network request). A failing job is logged and does not
 * stop the jobs after it.
 *
 * When a `checkIn` reporter is provided (see sentry-check-in.ts), each job is
 * bracketed with Sentry Crons check-ins — in_progress before, ok/error after,
 * paired by the id the opening check-in returns — so Sentry can alert on
 * missed and failed runs. The monitor slug is the endpoint basename.
 *
 * The request URL must use the real `env.ORIGIN`: the generated worker caches
 * its origin from the first request URL it sees, and on a cold start the
 * scheduled invocation can be that first request.
 */
export async function runScheduledJobs(
	cron: string,
	env: CronEnv,
	fetcher: (request: Request) => Promise<Response>,
	checkIn?: CronCheckIn
): Promise<CronJobResult[]> {
	const paths = CRON_SCHEDULE[cron];
	if (!paths) {
		console.warn(`[cron] no jobs mapped for expression "${cron}"`);
		return [];
	}

	const results: CronJobResult[] = [];
	for (const path of paths) {
		const slug = path.split('/').at(-1) ?? path;
		const checkInId = await checkIn?.({ slug, status: 'in_progress', cron });
		let result: CronJobResult;
		try {
			const response = await fetcher(
				new Request(`${env.ORIGIN}${path}`, {
					method: 'POST',
					headers: { authorization: `Bearer ${env.CRON_SECRET ?? ''}` }
				})
			);
			const body = await response.text();
			if (response.ok) {
				console.log(`[cron] ${path} ${response.status}: ${body}`);
			} else {
				console.error(`[cron] ${path} failed with ${response.status}: ${body}`);
			}
			result = { path, ok: response.ok, status: response.status };
		} catch (err) {
			console.error(`[cron] ${path} threw:`, err);
			result = { path, ok: false, error: err instanceof Error ? err.message : String(err) };
		}
		await checkIn?.({ slug, status: result.ok ? 'ok' : 'error', checkInId });
		results.push(result);
	}
	return results;
}
