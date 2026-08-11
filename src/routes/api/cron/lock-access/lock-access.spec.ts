import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRunDailyLockJob = vi.fn();

vi.mock('$lib/server/lock/lock-service', () => ({
	runDailyLockJob: (...args: unknown[]) => mockRunDailyLockJob(...args)
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
		request: new Request('http://localhost/api/cron/lock-access', {
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

describe('POST /api/cron/lock-access', () => {
	it('rejects requests without valid auth', async () => {
		await expect(POST(req('wrong-secret'))).rejects.toThrow();
	});

	it('delegates to runDailyLockJob', async () => {
		mockRunDailyLockJob.mockResolvedValue({ provisioned: 2, cleaned: 1, errors: [] });

		await POST(req());

		expect(mockRunDailyLockJob).toHaveBeenCalled();
	});

	it('returns provisioned, cleaned, and errors in response', async () => {
		mockRunDailyLockJob.mockResolvedValue({
			provisioned: 4,
			cleaned: 2,
			errors: ['lock-xyz failed']
		});

		const response = await POST(req());
		const body = await response.json();

		expect(body).toEqual({ provisioned: 4, cleaned: 2, errors: ['lock-xyz failed'] });
	});
});
