import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockWake = vi.fn();
vi.mock('$lib/server/inbox/thread-service', () => ({
	wakeSnoozedThreads: (...args: unknown[]) => mockWake(...args)
}));

vi.mock('$env/dynamic/private', () => ({
	env: { CRON_SECRET: 'test-secret' }
}));

function post(auth?: string) {
	return new Request('http://localhost/api/cron/wake-snoozed', {
		method: 'POST',
		headers: auth ? { Authorization: auth } : {}
	});
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('POST /api/cron/wake-snoozed', () => {
	it('rejects requests without the cron secret', async () => {
		const { POST } = await import('./+server');

		await expect(POST({ request: post() } as never)).rejects.toThrow();
		expect(mockWake).not.toHaveBeenCalled();
	});

	it('rejects requests with the wrong secret', async () => {
		const { POST } = await import('./+server');

		await expect(POST({ request: post('Bearer nope') } as never)).rejects.toThrow();
		expect(mockWake).not.toHaveBeenCalled();
	});

	it('returns the number of threads returned to the queue', async () => {
		mockWake.mockResolvedValue({ woken: 3 });
		const { POST } = await import('./+server');

		const response = await POST({ request: post('Bearer test-secret') } as never);

		expect(await response.json()).toEqual({ woken: 3 });
		expect(mockWake).toHaveBeenCalledTimes(1);
	});
});
