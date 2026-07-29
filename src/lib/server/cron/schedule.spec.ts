import { describe, it, expect, vi } from 'vitest';
import { CRON_SCHEDULE, runScheduledJobs } from './schedule';

const env = { ORIGIN: 'https://corvmc.test', CRON_SECRET: 'test-secret' };

const ALL_ENDPOINTS = [
	'/api/cron/auto-complete',
	'/api/cron/cancel-unconfirmed',
	'/api/cron/expire-waitlisted',
	'/api/cron/confirmation-reminders',
	'/api/cron/reservation-reminders',
	'/api/cron/generate-recurring-reservations',
	'/api/cron/lock-access',
	'/api/cron/send-campaigns'
];

function okFetcher() {
	return vi.fn<(request: Request) => Promise<Response>>(
		async () => new Response(JSON.stringify({ ok: true }), { status: 200 })
	);
}

describe('CRON_SCHEDULE', () => {
	it('covers every cron endpoint exactly once', () => {
		const scheduled = Object.values(CRON_SCHEDULE).flat();
		expect(scheduled.toSorted()).toEqual(ALL_ENDPOINTS.toSorted());
	});

	it('runs the daily batch in dependency order (generation before locks and reminders)', () => {
		expect(CRON_SCHEDULE['0 16 * * *']).toEqual([
			'/api/cron/generate-recurring-reservations',
			'/api/cron/lock-access',
			'/api/cron/confirmation-reminders',
			'/api/cron/reservation-reminders'
		]);
	});
});

describe('runScheduledJobs', () => {
	it('POSTs each mapped endpoint at ORIGIN with the bearer secret', async () => {
		const fetcher = okFetcher();

		const results = await runScheduledJobs('*/15 * * * *', env, fetcher);

		expect(fetcher).toHaveBeenCalledTimes(3);
		const requests = fetcher.mock.calls.map(([request]: [Request]) => request);
		expect(requests.map((r) => r.url)).toEqual([
			'https://corvmc.test/api/cron/auto-complete',
			'https://corvmc.test/api/cron/cancel-unconfirmed',
			'https://corvmc.test/api/cron/expire-waitlisted'
		]);
		for (const request of requests) {
			expect(request.method).toBe('POST');
			expect(request.headers.get('authorization')).toBe('Bearer test-secret');
		}
		expect(results.every((r) => r.ok)).toBe(true);
	});

	it('awaits jobs sequentially, not in parallel', async () => {
		let inFlight = 0;
		let maxInFlight = 0;
		const fetcher = vi.fn(async () => {
			inFlight++;
			maxInFlight = Math.max(maxInFlight, inFlight);
			await new Promise((resolve) => setTimeout(resolve, 0));
			inFlight--;
			return new Response('{}', { status: 200 });
		});

		await runScheduledJobs('0 16 * * *', env, fetcher);

		expect(fetcher).toHaveBeenCalledTimes(4);
		expect(maxInFlight).toBe(1);
	});

	it('continues past a job that throws and reports the failure', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const fetcher = vi
			.fn<(request: Request) => Promise<Response>>()
			.mockRejectedValueOnce(new Error('boom'))
			.mockImplementation(async () => new Response('{}', { status: 200 }));

		const results = await runScheduledJobs('*/15 * * * *', env, fetcher);

		expect(fetcher).toHaveBeenCalledTimes(3);
		expect(results).toEqual([
			{ path: '/api/cron/auto-complete', ok: false, error: 'boom' },
			{ path: '/api/cron/cancel-unconfirmed', ok: true, status: 200 },
			{ path: '/api/cron/expire-waitlisted', ok: true, status: 200 }
		]);
	});

	it('marks non-2xx responses as failed without stopping the batch', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const fetcher = vi
			.fn<(request: Request) => Promise<Response>>()
			.mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }))
			.mockImplementation(async () => new Response('{}', { status: 200 }));

		const results = await runScheduledJobs('*/15 * * * *', env, fetcher);

		expect(results.map((r) => ({ ok: r.ok, status: r.status }))).toEqual([
			{ ok: false, status: 401 },
			{ ok: true, status: 200 },
			{ ok: true, status: 200 }
		]);
	});

	it('runs nothing for an unmapped cron expression', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const fetcher = okFetcher();

		const results = await runScheduledJobs('59 23 * * *', env, fetcher);

		expect(fetcher).not.toHaveBeenCalled();
		expect(results).toEqual([]);
	});
});
