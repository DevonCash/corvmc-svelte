import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

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

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------

// The import stays dynamic so it resolves after the `vi.mock` calls above, but
// it is hoisted out of the test bodies: on a cold `node_modules/.vite` cache the
// first import transforms the whole module graph, which blows the 5s per-test
// timeout if it happens inside an `it()`.
let POST: typeof import('./+server').POST;

beforeAll(async () => {
	({ POST } = await import('./+server'));
});

describe('POST /api/cron/wake-snoozed', () => {
	it('rejects requests without the cron secret', async () => {
		await expect(POST({ request: post() } as never)).rejects.toThrow();
		expect(mockWake).not.toHaveBeenCalled();
	});

	it('rejects requests with the wrong secret', async () => {
		await expect(POST({ request: post('Bearer nope') } as never)).rejects.toThrow();
		expect(mockWake).not.toHaveBeenCalled();
	});

	it('returns the number of threads returned to the queue', async () => {
		mockWake.mockResolvedValue({ woken: 3 });

		const response = await POST({ request: post('Bearer test-secret') } as never);

		expect(await response.json()).toEqual({ woken: 3 });
		expect(mockWake).toHaveBeenCalledTimes(1);
	});
});
