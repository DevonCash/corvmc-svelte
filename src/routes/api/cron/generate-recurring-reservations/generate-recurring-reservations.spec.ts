import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGenerateRecurringReservations = vi.fn();

vi.mock('$lib/server/reservation/generation-job', () => ({
	generateRecurringReservations: (...args: unknown[]) => mockGenerateRecurringReservations(...args)
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
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/cron/generate-recurring-reservations', () => {
	it('rejects requests without valid auth', async () => {
		const { POST } = await import('./+server');
		await expect(POST(req('wrong-secret'))).rejects.toThrow();
	});

	it('delegates to generateRecurringReservations', async () => {
		mockGenerateRecurringReservations.mockResolvedValue({ created: 5, skipped: 2 });

		const { POST } = await import('./+server');
		await POST(req());

		expect(mockGenerateRecurringReservations).toHaveBeenCalled();
	});

	it('returns result from generation job', async () => {
		const result = { created: 3, skipped: 1, errors: [] };
		mockGenerateRecurringReservations.mockResolvedValue(result);

		const { POST } = await import('./+server');
		const response = await POST(req());
		const body = await response.json();

		expect(body).toEqual(result);
	});
});
