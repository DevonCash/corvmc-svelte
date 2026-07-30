import { describe, it, expect, vi, afterEach } from 'vitest';
import { createSentryCheckIn } from './sentry-check-in';

function stubFetch(response: Response | (() => Promise<Response>)) {
	const fetchMock = vi.fn<typeof fetch>(
		typeof response === 'function' ? response : async () => response
	);
	vi.stubGlobal('fetch', fetchMock);
	return fetchMock;
}

function lastCall(fetchMock: ReturnType<typeof stubFetch>) {
	const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
	return { url, body: JSON.parse(init.body as string) };
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('createSentryCheckIn', () => {
	it('POSTs to the DSN-derived check-in URL for the monitor slug', async () => {
		const fetchMock = stubFetch(new Response(JSON.stringify({ id: 'ci-1' }), { status: 201 }));

		const id = await createSentryCheckIn()({ slug: 'auto-complete', status: 'in_progress' });

		expect(id).toBe('ci-1');
		const { url } = lastCall(fetchMock);
		expect(url).toBe(
			'https://o4510014650384384.ingest.us.sentry.io/api/4511504553738240/cron/auto-complete/3b421fec8a5c7c5236b673d9ac5bdd9f/'
		);
	});

	it('upserts monitor_config on in_progress when a cron expression is given', async () => {
		const fetchMock = stubFetch(new Response(JSON.stringify({ id: 'ci-2' }), { status: 201 }));

		await createSentryCheckIn('development')({
			slug: 'send-campaigns',
			status: 'in_progress',
			cron: '*/5 * * * *'
		});

		const { body } = lastCall(fetchMock);
		expect(body).toEqual({
			status: 'in_progress',
			environment: 'development',
			monitor_config: {
				schedule: { type: 'crontab', value: '*/5 * * * *' },
				timezone: 'Etc/UTC',
				checkin_margin: 10,
				max_runtime: 15
			}
		});
	});

	it('closes with check_in_id and no monitor_config, defaulting to production', async () => {
		const fetchMock = stubFetch(new Response(JSON.stringify({ id: 'ci-3' }), { status: 201 }));

		await createSentryCheckIn()({ slug: 'lock-access', status: 'ok', checkInId: 'ci-3' });

		const { body } = lastCall(fetchMock);
		expect(body).toEqual({ status: 'ok', environment: 'production', check_in_id: 'ci-3' });
	});

	it('returns undefined on a rejected fetch without throwing', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		stubFetch(() => Promise.reject(new Error('network down')));

		const id = await createSentryCheckIn()({ slug: 'auto-complete', status: 'ok' });

		expect(id).toBeUndefined();
		expect(console.warn).toHaveBeenCalledOnce();
	});

	it('returns undefined on a non-2xx response without throwing', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		stubFetch(new Response('rate limited', { status: 429 }));

		const id = await createSentryCheckIn()({ slug: 'auto-complete', status: 'in_progress' });

		expect(id).toBeUndefined();
		expect(console.warn).toHaveBeenCalledOnce();
	});
});
