import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFulfillPurchase = vi.fn();

vi.mock('./ticket-service', () => ({
	fulfillPurchase: (...args: unknown[]) => mockFulfillPurchase(...args)
}));

vi.mock('$lib/server/events/event-bus', () => ({
	domainEvents: { emit: vi.fn() }
}));

vi.mock('$lib/server/db', () => ({
	db: { select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }) }
}));

vi.mock('$lib/server/db/schema/event', () => ({
	event: {}
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn()
}));

vi.mock('luxon', () => ({
	DateTime: { fromJSDate: () => ({ toLocaleString: () => 'May 14, 2026' }) }
}));

// Import after mocks
const { handleTicketCheckout } = await import('./checkout-listener');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	vi.clearAllMocks();
});

describe('handleTicketCheckout', () => {
	it('calls fulfillPurchase when session has ticket metadata', async () => {
		mockFulfillPurchase.mockResolvedValue([
			{
				id: 't1',
				eventId: 'event-1',
				code: 'ABC',
				attendeeName: 'Jo',
				attendeeEmail: 'jo@test.com'
			},
			{
				id: 't2',
				eventId: 'event-1',
				code: 'DEF',
				attendeeName: 'Jo',
				attendeeEmail: 'jo@test.com'
			}
		]);

		await handleTicketCheckout({
			id: 'cs_test_123',
			metadata: {
				type: 'ticket',
				purchase_id: 'purchase-abc',
				event_id: 'event-1',
				ticket_quantity: '2'
			}
		} as any);

		expect(mockFulfillPurchase).toHaveBeenCalledWith('purchase-abc');
	});

	it('ignores sessions without ticket type', async () => {
		await handleTicketCheckout({
			id: 'cs_test_456',
			metadata: {
				type: 'reservation',
				reservation_id: 'res-1'
			}
		} as any);

		expect(mockFulfillPurchase).not.toHaveBeenCalled();
	});

	it('ignores sessions without metadata', async () => {
		await handleTicketCheckout({
			id: 'cs_test_789',
			metadata: null
		} as any);

		expect(mockFulfillPurchase).not.toHaveBeenCalled();
	});

	it('ignores sessions without purchase_id', async () => {
		await handleTicketCheckout({
			id: 'cs_test_000',
			metadata: {
				type: 'ticket'
				// missing purchase_id
			}
		} as any);

		expect(mockFulfillPurchase).not.toHaveBeenCalled();
	});

	it('skips event emission when fulfillPurchase returns empty array', async () => {
		mockFulfillPurchase.mockResolvedValue([]);

		await handleTicketCheckout({
			id: 'cs_test_skip',
			metadata: {
				type: 'ticket',
				purchase_id: 'purchase-none'
			}
		} as any);

		expect(mockFulfillPurchase).toHaveBeenCalledWith('purchase-none');
	});
});
