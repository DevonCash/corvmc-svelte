import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGenerateRecurring = vi.fn();

vi.mock('$lib/server/reservation/generation-job', () => ({
	generateRecurring: (...args: unknown[]) => mockGenerateRecurring(...args)
}));

vi.mock('$env/dynamic/private', () => ({
	env: { CRON_SECRET: 'test-secret' }
}));

beforeEach(() => {
	vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function req(secret?: string) {
	return {
		request: new Request('http://localhost/api/cron/generate-recurring-reservations', {
			method: 'POST',
			headers: { Authorization: `Bearer ${secret ?? 'test-secret'}` }
		})
	} as any;
}

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/cron/generate-recurring-reservations', () => {
	it('rejects requests without valid auth', async () => {
		await expect(POST(req('wrong-secret'))).rejects.toThrow();
	});

	it('delegates to generateRecurring', async () => {
		mockGenerateRecurring.mockResolvedValue({ created: 5, skipped: 2 });

		await POST(req());

		expect(mockGenerateRecurring).toHaveBeenCalled();
	});

	it('returns result from generation job', async () => {
		const result = { events: {}, reservations: { created: 3, skipped: 1, errors: [] } };
		mockGenerateRecurring.mockResolvedValue(result);

		const response = await POST(req());
		const body = await response.json();

		expect(body).toEqual(result);
	});
});
