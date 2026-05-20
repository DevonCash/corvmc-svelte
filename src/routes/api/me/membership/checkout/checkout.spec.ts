import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockCreateCheckoutSession = vi.fn();

vi.mock('$lib/server/finance/subscription-service', () => ({
	createCheckoutSession: (...args: unknown[]) => mockCreateCheckoutSession(...args)
}));

vi.mock('$lib/config', () => ({
	DOLLARS_PER_UNIT: 5
}));

beforeEach(() => {
	vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function req(opts?: {
	user?: Record<string, unknown> | null;
	fields?: Record<string, string>;
}) {
	const fd = new FormData();
	if (opts?.fields) {
		for (const [k, v] of Object.entries(opts.fields)) {
			fd.append(k, v);
		}
	}

	return {
		locals: {
			user: opts?.user === null ? null : (opts?.user ?? {
				id: 'user-1',
				stripeId: 'cus_123',
				name: 'Test User'
			})
		},
		request: new Request('http://localhost/api/me/membership/checkout', {
			method: 'POST',
			body: fd
		})
	} as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/me/membership/checkout', () => {
	it('returns 401 when user is not logged in', async () => {
		const { POST } = await import('./+server');
		const response = await POST(req({ user: null }));

		expect(response.status).toBe(401);
	});

	it('returns 400 when user has no stripeId', async () => {
		const { POST } = await import('./+server');
		const response = await POST(req({ user: { id: 'user-1', stripeId: null } }));

		expect(response.status).toBe(400);
		const body = await response.json() as any;
		expect(body.error).toContain('billing account');
	});

	it('returns 400 for amount below minimum', async () => {
		const { POST } = await import('./+server');
		const response = await POST(req({ fields: { amount: '5' } }));

		expect(response.status).toBe(400);
		const body = await response.json() as any;
		expect(body.error).toContain('at least');
	});

	it('returns 400 for amount not a multiple of DOLLARS_PER_UNIT', async () => {
		const { POST } = await import('./+server');
		const response = await POST(req({ fields: { amount: '12' } }));

		expect(response.status).toBe(400);
		const body = await response.json() as any;
		expect(body.error).toContain('multiple');
	});

	it('returns 400 for NaN amount', async () => {
		const { POST } = await import('./+server');
		const response = await POST(req({ fields: { amount: 'abc' } }));

		expect(response.status).toBe(400);
	});

	it('accepts valid amount and delegates to createCheckoutSession', async () => {
		mockCreateCheckoutSession.mockResolvedValue('https://checkout.stripe.com/session_1');

		const { POST } = await import('./+server');
		const response = await POST(req({ fields: { amount: '10' } }));

		expect(response.status).toBe(200);
		expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: 'user-1',
				stripeCustomerId: 'cus_123',
				quantity: 2
			})
		);
	});

	it('returns redirectUrl from checkout session', async () => {
		mockCreateCheckoutSession.mockResolvedValue('https://checkout.stripe.com/session_2');

		const { POST } = await import('./+server');
		const response = await POST(req({ fields: { amount: '15' } }));

		const body = await response.json() as any;
		expect(body.redirectUrl).toBe('https://checkout.stripe.com/session_2');
	});

	it('passes coverFees=true when form field is "on"', async () => {
		mockCreateCheckoutSession.mockResolvedValue('https://checkout.stripe.com/s');

		const { POST } = await import('./+server');
		await POST(req({ fields: { amount: '10', coverFees: 'on' } }));

		expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
			expect.objectContaining({ coverFees: true })
		);
	});

	it('returns 500 when createCheckoutSession throws', async () => {
		mockCreateCheckoutSession.mockRejectedValue(new Error('Stripe error'));

		const { POST } = await import('./+server');
		const response = await POST(req({ fields: { amount: '10' } }));

		expect(response.status).toBe(500);
	});
});
