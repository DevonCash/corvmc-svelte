import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetById = vi.fn();
vi.mock('$lib/server/event/event-service', () => ({
	getById: (...args: unknown[]) => mockGetById(...args)
}));

const mockGetTicketsRemaining = vi.fn();
const mockCreateTickets = vi.fn();
const mockFulfillPurchase = vi.fn();
vi.mock('$lib/server/ticket/ticket-service', () => ({
	getTicketsRemaining: (...args: unknown[]) => mockGetTicketsRemaining(...args),
	createTickets: (...args: unknown[]) => mockCreateTickets(...args),
	fulfillPurchase: (...args: unknown[]) => mockFulfillPurchase(...args)
}));

const mockGetSubscription = vi.fn();
vi.mock('$lib/server/finance/subscription-service', () => ({
	getSubscription: (...args: unknown[]) => mockGetSubscription(...args)
}));

const mockCheckout = vi.fn();
vi.mock('$lib/server/finance/payment-service', () => ({
	checkout: (...args: unknown[]) => mockCheckout(...args)
}));

const mockBuildLineItem = vi.fn();
vi.mock('$lib/server/finance/product-config-service', () => ({
	buildLineItem: (...args: unknown[]) => mockBuildLineItem(...args)
}));

vi.mock('crypto', () => ({
	randomUUID: () => 'uuid-test-1234'
}));

beforeEach(() => {
	vi.clearAllMocks();
	mockBuildLineItem.mockResolvedValue({ name: 'Ticket', amount: 1000, quantity: 1 });
	mockCreateTickets.mockResolvedValue(undefined);
	mockGetSubscription.mockResolvedValue(null);
	mockGetTicketsRemaining.mockResolvedValue(100);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides?: Record<string, unknown>) {
	return {
		id: 'event-1',
		status: 'published',
		ticketingEnabled: true,
		ticketPrice: 1000,
		title: 'Test Event',
		...overrides
	};
}

function req(opts?: {
	user?: Record<string, unknown> | null;
	fields?: Record<string, string>;
	params?: Record<string, string>;
}) {
	const fd = new FormData();
	const defaults = { quantity: '2', attendeeName: 'Alice', attendeeEmail: 'alice@test.com' };
	const fields = { ...defaults, ...opts?.fields };
	for (const [k, v] of Object.entries(fields)) fd.append(k, v);

	const user = opts?.user === null ? null : (opts?.user ?? { id: 'user-1', stripeId: 'cus_1' });

	return {
		locals: { user },
		params: opts?.params ?? { id: 'event-1' },
		request: new Request('http://localhost/api/events/event-1/tickets/purchase', {
			method: 'POST',
			body: fd
		})
	} as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/events/[id]/tickets/purchase', () => {
	describe('event validation', () => {
		it('returns 404 when event not found', async () => {
			mockGetById.mockResolvedValue(null);
			const { POST } = await import('./+server');
			const response = await POST(req());
			expect(response.status).toBe(404);
		});

		it('returns 400 when event is not published', async () => {
			mockGetById.mockResolvedValue(makeEvent({ status: 'draft' }));
			const { POST } = await import('./+server');
			const response = await POST(req());
			expect(response.status).toBe(400);
		});

		it('returns 400 when ticketing is not enabled', async () => {
			mockGetById.mockResolvedValue(makeEvent({ ticketingEnabled: false }));
			const { POST } = await import('./+server');
			const response = await POST(req());
			expect(response.status).toBe(400);
		});
	});

	describe('input validation', () => {
		it('rejects quantity < 1', async () => {
			mockGetById.mockResolvedValue(makeEvent());
			const { POST } = await import('./+server');
			const response = await POST(req({ fields: { quantity: '0' } }));
			expect(response.status).toBe(400);
		});

		it('rejects quantity > 10', async () => {
			mockGetById.mockResolvedValue(makeEvent());
			const { POST } = await import('./+server');
			const response = await POST(req({ fields: { quantity: '11' } }));
			expect(response.status).toBe(400);
		});

		it('rejects missing attendeeName', async () => {
			mockGetById.mockResolvedValue(makeEvent());
			const { POST } = await import('./+server');
			const response = await POST(req({ fields: { attendeeName: '' } }));
			expect(response.status).toBe(400);
		});

		it('rejects invalid attendeeEmail', async () => {
			mockGetById.mockResolvedValue(makeEvent());
			const { POST } = await import('./+server');
			const response = await POST(req({ fields: { attendeeEmail: 'notanemail' } }));
			expect(response.status).toBe(400);
		});
	});

	describe('capacity checking', () => {
		it('returns 400 when sold out', async () => {
			mockGetById.mockResolvedValue(makeEvent());
			mockGetTicketsRemaining.mockResolvedValue(0);

			const { POST } = await import('./+server');
			const response = await POST(req());
			const body = await response.json() as any;

			expect(response.status).toBe(400);
			expect(body.error).toContain('sold out');
		});

		it('returns 400 when quantity exceeds remaining', async () => {
			mockGetById.mockResolvedValue(makeEvent());
			mockGetTicketsRemaining.mockResolvedValue(1);

			const { POST } = await import('./+server');
			const response = await POST(req({ fields: { quantity: '2' } }));

			expect(response.status).toBe(400);
		});

		it('allows purchase when remaining is null (unlimited)', async () => {
			mockGetById.mockResolvedValue(makeEvent());
			mockGetTicketsRemaining.mockResolvedValue(null);
			mockCheckout.mockResolvedValue({ paid: false, checkoutUrl: 'https://checkout.stripe.com/s' });

			const { POST } = await import('./+server');
			const response = await POST(req());

			expect(response.status).toBe(200);
		});
	});

	describe('sustaining member discount', () => {
		it('halves ticket price when user has active subscription', async () => {
			mockGetById.mockResolvedValue(makeEvent({ ticketPrice: 2000 }));
			mockGetSubscription.mockResolvedValue({ id: 'sub_1', status: 'active' });
			mockCheckout.mockResolvedValue({ paid: false, checkoutUrl: 'https://checkout.stripe.com/s' });

			const { POST } = await import('./+server');
			await POST(req());

			expect(mockBuildLineItem).toHaveBeenCalledWith('ticket', 1000, 2);
		});

		it('uses full price when user has no subscription', async () => {
			mockGetById.mockResolvedValue(makeEvent({ ticketPrice: 2000 }));
			mockGetSubscription.mockResolvedValue(null);
			mockCheckout.mockResolvedValue({ paid: false, checkoutUrl: 'https://checkout.stripe.com/s' });

			const { POST } = await import('./+server');
			await POST(req());

			expect(mockBuildLineItem).toHaveBeenCalledWith('ticket', 2000, 2);
		});

		it('uses full price for anonymous users', async () => {
			mockGetById.mockResolvedValue(makeEvent({ ticketPrice: 2000 }));
			mockCheckout.mockResolvedValue({ paid: false, checkoutUrl: 'https://checkout.stripe.com/s' });

			const { POST } = await import('./+server');
			await POST(req({ user: null }));

			expect(mockBuildLineItem).toHaveBeenCalledWith('ticket', 2000, 2);
			expect(mockGetSubscription).not.toHaveBeenCalled();
		});
	});

	describe('checkout flow', () => {
		it('creates pending tickets with correct metadata', async () => {
			mockGetById.mockResolvedValue(makeEvent());
			mockCheckout.mockResolvedValue({ paid: false, checkoutUrl: 'https://checkout.stripe.com/s' });

			const { POST } = await import('./+server');
			await POST(req());

			expect(mockCreateTickets).toHaveBeenCalledWith(
				expect.objectContaining({
					eventId: 'event-1',
					purchaseId: 'uuid-test-1234',
					quantity: 2,
					attendeeName: 'Alice',
					attendeeEmail: 'alice@test.com',
					status: 'pending'
				})
			);
		});

		it('delegates to checkout with correct metadata', async () => {
			mockGetById.mockResolvedValue(makeEvent());
			mockCheckout.mockResolvedValue({ paid: false, checkoutUrl: 'https://checkout.stripe.com/s' });

			const { POST } = await import('./+server');
			await POST(req());

			expect(mockCheckout).toHaveBeenCalledWith(
				expect.objectContaining({
					metadata: expect.objectContaining({
						type: 'ticket',
						purchase_id: 'uuid-test-1234',
						event_id: 'event-1',
						ticket_quantity: '2'
					})
				})
			);
		});

		it('fulfills purchase immediately when credits cover cost', async () => {
			mockGetById.mockResolvedValue(makeEvent());
			mockCheckout.mockResolvedValue({ paid: true });
			mockFulfillPurchase.mockResolvedValue(undefined);

			const { POST } = await import('./+server');
			const response = await POST(req());
			const body = await response.json() as any;

			expect(mockFulfillPurchase).toHaveBeenCalledWith('uuid-test-1234');
			expect(body.success).toBe(true);
			expect(body.redirectUrl).toContain('success');
		});

		it('returns Stripe checkout URL when payment needed', async () => {
			mockGetById.mockResolvedValue(makeEvent());
			mockCheckout.mockResolvedValue({ paid: false, checkoutUrl: 'https://checkout.stripe.com/pay' });

			const { POST } = await import('./+server');
			const response = await POST(req());
			const body = await response.json() as any;

			expect(body.redirectUrl).toBe('https://checkout.stripe.com/pay');
		});
	});

	describe('anonymous purchase', () => {
		it('works without locals.user', async () => {
			mockGetById.mockResolvedValue(makeEvent());
			mockCheckout.mockResolvedValue({ paid: false, checkoutUrl: 'https://checkout.stripe.com/s' });

			const { POST } = await import('./+server');
			const response = await POST(req({ user: null }));

			expect(response.status).toBe(200);
			expect(mockCreateTickets).toHaveBeenCalledWith(
				expect.objectContaining({ userId: undefined })
			);
		});
	});
});
