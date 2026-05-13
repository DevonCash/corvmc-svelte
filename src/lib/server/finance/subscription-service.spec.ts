import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock environment
// ---------------------------------------------------------------------------
vi.mock('$env/dynamic/private', () => ({
	env: {
		STRIPE_CONTRIBUTION_PRICE_ID: 'price_contribution',
		STRIPE_FEE_COVERAGE_PRICE_ID: 'price_fee_coverage'
	}
}));

// ---------------------------------------------------------------------------
// Mock Stripe SDK
// ---------------------------------------------------------------------------
const mockStripe = {
	checkout: {
		sessions: {
			create: vi.fn()
		}
	},
	subscriptions: {
		list: vi.fn(),
		update: vi.fn()
	}
};

vi.mock('$lib/server/stripe', () => ({
	stripe: mockStripe
}));

const {
	createCheckoutSession,
	getSubscription,
	updateQuantity,
	cancel,
	resume
} = await import('./subscription-service');

// ---------------------------------------------------------------------------
// createCheckoutSession
// ---------------------------------------------------------------------------
describe('createCheckoutSession', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('creates subscription checkout with correct quantity', async () => {
		mockStripe.checkout.sessions.create.mockResolvedValue({
			url: 'https://checkout.stripe.com/sub_sess'
		});

		const url = await createCheckoutSession({
			userId: 'user-1',
			stripeCustomerId: 'cus_123',
			quantity: 5,
			coverFees: false,
			successUrl: 'https://example.com/success',
			cancelUrl: 'https://example.com/cancel'
		});

		expect(url).toBe('https://checkout.stripe.com/sub_sess');
		expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
			expect.objectContaining({
				customer: 'cus_123',
				mode: 'subscription',
				line_items: [
					{ price: 'price_contribution', quantity: 5 }
				],
				metadata: expect.objectContaining({
					user_id: 'user-1',
					cover_fees: '0'
				})
			})
		);
	});

	it('adds fee coverage line item when coverFees is true', async () => {
		mockStripe.checkout.sessions.create.mockResolvedValue({
			url: 'https://checkout.stripe.com/sub_fee'
		});

		await createCheckoutSession({
			userId: 'user-1',
			stripeCustomerId: 'cus_123',
			quantity: 5,
			coverFees: true,
			successUrl: 'https://example.com/success',
			cancelUrl: 'https://example.com/cancel'
		});

		const call = mockStripe.checkout.sessions.create.mock.calls[0][0];
		expect(call.line_items).toHaveLength(2);
		expect(call.line_items[0]).toEqual({ price: 'price_contribution', quantity: 5 });
		expect(call.line_items[1].price).toBe('price_fee_coverage');
		// Fee coverage quantity should be > 0 (the fee in cents)
		expect(call.line_items[1].quantity).toBeGreaterThan(0);
		expect(call.metadata.cover_fees).toBe('1');
	});

	it('throws when quantity is less than 1', async () => {
		await expect(createCheckoutSession({
			userId: 'user-1',
			stripeCustomerId: 'cus_123',
			quantity: 0,
			coverFees: false,
			successUrl: 'https://example.com/success',
			cancelUrl: 'https://example.com/cancel'
		})).rejects.toThrow('Quantity must be at least 1');
	});
});

// ---------------------------------------------------------------------------
// getSubscription
// ---------------------------------------------------------------------------
describe('getSubscription', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns subscription info with fee coverage', async () => {
		mockStripe.subscriptions.list.mockResolvedValue({
			data: [{
				id: 'sub_abc',
				status: 'active',
				current_period_end: 1700000000,
				cancel_at_period_end: false,
				items: {
					data: [
						{ price: { id: 'price_contribution' }, quantity: 5 },
						{ price: { id: 'price_fee_coverage' }, quantity: 103 }
					]
				}
			}]
		});

		const info = await getSubscription('cus_123');

		expect(info).toEqual({
			id: 'sub_abc',
			status: 'active',
			quantity: 5,
			coveringFees: true,
			currentPeriodEnd: new Date(1700000000 * 1000),
			cancelAtPeriodEnd: false
		});
	});

	it('returns subscription info without fee coverage', async () => {
		mockStripe.subscriptions.list.mockResolvedValue({
			data: [{
				id: 'sub_no_fee',
				status: 'active',
				current_period_end: 1700000000,
				cancel_at_period_end: true,
				items: {
					data: [
						{ price: { id: 'price_contribution' }, quantity: 3 }
					]
				}
			}]
		});

		const info = await getSubscription('cus_123');

		expect(info).toMatchObject({
			quantity: 3,
			coveringFees: false,
			cancelAtPeriodEnd: true
		});
	});

	it('returns null when no active subscription', async () => {
		mockStripe.subscriptions.list.mockResolvedValue({ data: [] });
		expect(await getSubscription('cus_none')).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// updateQuantity
// ---------------------------------------------------------------------------
describe('updateQuantity', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('updates contribution quantity and adds fee item', async () => {
		mockStripe.subscriptions.list.mockResolvedValue({
			data: [{
				id: 'sub_upd',
				items: {
					data: [
						{ id: 'si_contrib', price: { id: 'price_contribution' }, quantity: 3 }
					]
				}
			}]
		});

		await updateQuantity('cus_123', 7, true);

		expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_upd', {
			items: expect.arrayContaining([
				{ id: 'si_contrib', quantity: 7 },
				expect.objectContaining({ price: 'price_fee_coverage' })
			])
		});
	});

	it('removes fee item when coverFees is false', async () => {
		mockStripe.subscriptions.list.mockResolvedValue({
			data: [{
				id: 'sub_rm_fee',
				items: {
					data: [
						{ id: 'si_contrib', price: { id: 'price_contribution' }, quantity: 5 },
						{ id: 'si_fee', price: { id: 'price_fee_coverage' }, quantity: 103 }
					]
				}
			}]
		});

		await updateQuantity('cus_123', 5, false);

		expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_rm_fee', {
			items: [
				{ id: 'si_contrib', quantity: 5 },
				{ id: 'si_fee', deleted: true }
			]
		});
	});

	it('throws when no active subscription', async () => {
		mockStripe.subscriptions.list.mockResolvedValue({ data: [] });
		await expect(updateQuantity('cus_ghost', 3, false)).rejects.toThrow('No active subscription found');
	});

	it('throws when quantity is less than 1', async () => {
		await expect(updateQuantity('cus_123', 0, false)).rejects.toThrow('Quantity must be at least 1');
	});
});

// ---------------------------------------------------------------------------
// cancel / resume
// ---------------------------------------------------------------------------
describe('cancel', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('sets cancel_at_period_end to true', async () => {
		mockStripe.subscriptions.list.mockResolvedValue({
			data: [{ id: 'sub_cancel', items: { data: [] } }]
		});

		await cancel('cus_123');

		expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_cancel', {
			cancel_at_period_end: true
		});
	});

	it('throws when no active subscription', async () => {
		mockStripe.subscriptions.list.mockResolvedValue({ data: [] });
		await expect(cancel('cus_ghost')).rejects.toThrow('No active subscription found');
	});
});

describe('resume', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('sets cancel_at_period_end to false', async () => {
		mockStripe.subscriptions.list.mockResolvedValue({
			data: [{ id: 'sub_resume', cancel_at_period_end: true, items: { data: [] } }]
		});

		await resume('cus_123');

		expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_resume', {
			cancel_at_period_end: false
		});
	});

	it('throws when subscription is not scheduled for cancellation', async () => {
		mockStripe.subscriptions.list.mockResolvedValue({
			data: [{ id: 'sub_active', cancel_at_period_end: false, items: { data: [] } }]
		});

		await expect(resume('cus_123')).rejects.toThrow('not scheduled for cancellation');
	});

	it('throws when no active subscription', async () => {
		mockStripe.subscriptions.list.mockResolvedValue({ data: [] });
		await expect(resume('cus_ghost')).rejects.toThrow('No active subscription found');
	});
});
