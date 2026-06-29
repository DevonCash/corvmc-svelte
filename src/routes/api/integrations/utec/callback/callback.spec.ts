import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (the authorize module is imported transitively for STATE_COOKIE, so
// its deps must be mocked too).
// ---------------------------------------------------------------------------

const mockRequireStaff = vi.fn().mockResolvedValue({ id: 'staff-1' });
vi.mock('$lib/server/authorization', () => ({
	requireStaff: () => mockRequireStaff()
}));

const mockExchange = vi.fn();
vi.mock('$lib/server/lock/ultraloc-client', () => ({
	exchangeAuthorizationCode: (...args: unknown[]) => mockExchange(...args),
	buildAuthorizeUrl: vi.fn(() => 'https://oauth.u-tec.com/authorize'),
	getUtecClientId: vi.fn().mockResolvedValue('cid')
}));

const mockUpdateSiteConfig = vi.fn().mockResolvedValue(undefined);
vi.mock('$lib/server/site-config/site-config-service', () => ({
	updateSiteConfig: (...args: unknown[]) => mockUpdateSiteConfig(...args)
}));

const { GET } = await import('./+server');

async function callGET(search: string, cookieValue: string | undefined) {
	const url = new URL(`http://localhost/api/integrations/utec/callback${search}`);
	const cookies = { get: vi.fn(() => cookieValue), delete: vi.fn() };
	try {
		// Partial event is sufficient for this handler.
		await GET({ url, cookies } as never);
		return null;
	} catch (e) {
		return e as { status: number; location: string };
	}
}

beforeEach(() => {
	vi.clearAllMocks();
	mockRequireStaff.mockResolvedValue({ id: 'staff-1' });
});

describe('U-tec OAuth callback', () => {
	it('rejects a mismatched state without exchanging', async () => {
		const redirect = await callGET('?code=abc&state=WRONG', 'RIGHT');

		expect(redirect?.status).toBe(303);
		expect(redirect?.location).toBe('/staff/settings?utec=state_error');
		expect(mockExchange).not.toHaveBeenCalled();
		expect(mockUpdateSiteConfig).not.toHaveBeenCalled();
	});

	it('redirects on a provider error', async () => {
		const redirect = await callGET('?error=access_denied&state=RIGHT', 'RIGHT');

		expect(redirect?.location).toBe('/staff/settings?utec=denied');
		expect(mockExchange).not.toHaveBeenCalled();
	});

	it('exchanges the code and stores the refresh token on success', async () => {
		mockExchange.mockResolvedValue({ refreshToken: 'rt', accessToken: 'at', expiresIn: 3600 });

		const redirect = await callGET('?code=abc&state=RIGHT', 'RIGHT');

		expect(mockExchange).toHaveBeenCalledWith(
			'abc',
			'http://localhost/api/integrations/utec/callback'
		);
		expect(mockUpdateSiteConfig).toHaveBeenCalledWith('integration.utec.refreshToken', 'rt');
		expect(redirect?.location).toBe('/staff/settings?utec=connected');
	});

	it('redirects on an exchange failure', async () => {
		mockExchange.mockRejectedValue(new Error('bad code'));
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const redirect = await callGET('?code=abc&state=RIGHT', 'RIGHT');

		expect(redirect?.location).toBe('/staff/settings?utec=exchange_failed');
		expect(mockUpdateSiteConfig).not.toHaveBeenCalled();

		consoleSpy.mockRestore();
	});
});
