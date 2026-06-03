import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockConstructEvent = vi.fn();
vi.mock('$lib/server/stripe', () => ({
	stripe: {
		webhooks: { constructEvent: (...args: unknown[]) => mockConstructEvent(...args) }
	}
}));

const mockHandler = vi.fn();
vi.mock('$lib/server/finance/webhook-handlers', () => ({
	webhookHandlerMap: {
		'checkout.session.completed': (...args: unknown[]) => mockHandler(...args)
	} as Record<string, (...args: unknown[]) => Promise<void>>
}));

vi.mock('$env/dynamic/private', () => ({
	env: { STRIPE_WEBHOOK_SECRET: 'whsec_test' }
}));

beforeEach(() => {
	vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/stripe/webhook', () => {
	function req(opts?: { signature?: string | null; body?: string }) {
		const headers: Record<string, string> = {};
		if (opts?.signature !== null) {
			headers['stripe-signature'] = opts?.signature ?? 'sig_valid';
		}
		return {
			request: new Request('http://localhost/api/stripe/webhook', {
				method: 'POST',
				headers,
				body: opts?.body ?? '{"test":true}'
			})
		} as any;
	}

	it('returns 400 when stripe-signature header is missing', async () => {
		const { POST } = await import('./+server');
		await expect(POST(req({ signature: null }))).rejects.toThrow();
	});

	it('returns 400 when signature verification fails', async () => {
		mockConstructEvent.mockImplementation(() => {
			throw new Error('Invalid signature');
		});

		const { POST } = await import('./+server');
		await expect(POST(req())).rejects.toThrow();
	});

	it('routes to correct handler from webhookHandlerMap', async () => {
		const mockDataObject = { id: 'cs_123', metadata: {} };
		mockConstructEvent.mockReturnValue({
			type: 'checkout.session.completed',
			id: 'evt_123',
			data: { object: mockDataObject }
		});
		mockHandler.mockResolvedValue(undefined);

		const { POST } = await import('./+server');
		const response = await POST(req());
		const body = await response.json() as any;

		expect(body).toEqual({ received: true });
		expect(mockHandler).toHaveBeenCalledWith(mockDataObject);
	});

	it('returns 200 when no handler exists for event type', async () => {
		mockConstructEvent.mockReturnValue({
			type: 'unknown.event.type',
			id: 'evt_456',
			data: { object: {} }
		});

		const { POST } = await import('./+server');
		const response = await POST(req());
		const body = await response.json() as any;

		expect(body).toEqual({ received: true });
		expect(mockHandler).not.toHaveBeenCalled();
	});

	it('returns 200 even when handler throws', async () => {
		// The handler only swallows errors in non-DEV; vitest sets import.meta.env.DEV true.
		vi.stubEnv('DEV', false);
		mockConstructEvent.mockReturnValue({
			type: 'checkout.session.completed',
			id: 'evt_789',
			data: { object: {} }
		});
		mockHandler.mockRejectedValue(new Error('handler exploded'));

		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const { POST } = await import('./+server');
		const response = await POST(req());
		const body = await response.json() as any;

		expect(body).toEqual({ received: true });
		consoleSpy.mockRestore();
		vi.unstubAllEnvs();
	});

	it('logs error when handler throws', async () => {
		vi.stubEnv('DEV', false);
		mockConstructEvent.mockReturnValue({
			type: 'checkout.session.completed',
			id: 'evt_err',
			data: { object: {} }
		});
		const handlerError = new Error('handler failed');
		mockHandler.mockRejectedValue(handlerError);

		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const { POST } = await import('./+server');
		await POST(req());

		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining('checkout.session.completed'),
			handlerError
		);
		consoleSpy.mockRestore();
		vi.unstubAllEnvs();
	});
});
