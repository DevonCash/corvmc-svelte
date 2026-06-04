import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockProcessDueCampaigns = vi.fn();

vi.mock('$lib/server/marketing/campaign-service', () => ({
	processDueCampaigns: (...args: unknown[]) => mockProcessDueCampaigns(...args)
}));

// isFeatureEnabled reads from site-config which depends on KV (uninitialized in tests).
// Mock the feature-flags layer so the handler runs past the feature gate.
const mockIsFeatureEnabled = vi.fn(async () => true);

vi.mock('$lib/server/feature-flags', () => ({
	isFeatureEnabled: (..._args: unknown[]) => mockIsFeatureEnabled()
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
		request: new Request('http://localhost/api/cron/send-campaigns', {
			method: 'POST',
			headers: { Authorization: `Bearer ${secret ?? 'test-secret'}` }
		})
	} as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/cron/send-campaigns', () => {
	it('rejects requests without valid auth', async () => {
		const { POST } = await import('./+server');
		await expect(POST(req('wrong-secret'))).rejects.toThrow();
	});

	it('delegates to processDueCampaigns', async () => {
		mockProcessDueCampaigns.mockResolvedValue(3);

		const { POST } = await import('./+server');
		await POST(req());

		expect(mockProcessDueCampaigns).toHaveBeenCalled();
	});

	it('returns processed count in response', async () => {
		mockProcessDueCampaigns.mockResolvedValue(5);

		const { POST } = await import('./+server');
		const response = await POST(req());
		const body = await response.json();

		expect(body).toEqual({ processed: 5 });
	});
});
