import { describe, it, expect, vi, beforeEach } from 'vitest';

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

// The import stays dynamic so it resolves after the `vi.mock` calls above, and
// sits at module scope so the cold Vite transform of the whole module graph is
// paid once, during file evaluation — not inside a test or hook, where it would
// race the 5s test / 10s hook timeout on a cold `node_modules/.vite`.
const { POST } = await import('./+server');

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
