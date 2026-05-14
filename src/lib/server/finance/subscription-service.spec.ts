import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock environment
// ---------------------------------------------------------------------------
vi.mock('$env/dynamic/private', () => ({
	env: {
		STRIPE_CONTRIBUTION_PRICE_ID: 'price_contribution',
		STRIPE_FEE_PRODUCT_ID: 'prod_fee',
		DATABASE_URL: 'postgres://mock'
	}
}));

// Mock product-config-service to prevent db import chain
vi.mock('./product-config-service', () => ({
	getStripeProductId: vi.fn().mockImplementation((key: string) => {
		if (key === 'contribution') return Promise.resolve('prod_contribution');
		if (key === 'fee_coverage') return Promise.resolve('prod_fee');
		return Promise.resolve(`prod_${key}`);
	}),
	getProductConfig: vi.fn().mockResolvedValue({
		key: 'contribution',
		name: 'Monthly Contribution',
		description: 'Monthly membership contribution',
		stripeProductId: 'prod_contribution',
		unitAmountCents: 500,
		unitLabel: null
	}),
	buildSubscriptionLineItem: vi.fn().mockImplementation(
		(_key: string, unitAmount: number, quantity: number) =>
			Promise.resolve({
				price_data: {
					currency: 'usd',
					product: 'prod_contribution',
					unit_amount: unitAmount,
					recurring: { interval: 'month' }
				},
				quantity
			})
	)
}));

// ---------------------------------------------------------------------------
// Mock Stripe SDK
// ---------------------------------------------------------------------------
const mockStripe = {
	subscriptions: {
		list: vi.fn(),
		update: vi.fn()
	},
	billingPortal: {
		sessions: {
			create: vi.fn()
		}
	}
};

vi.mock('$lib/server/stripe', () => ({
	stripe: mockStripe
}));

// ---------------------------------------------------------------------------
// Mock shared checkout
// ---------------------------------------------------------------------------
const mockCheckout = vi.fn();
vi.mock('./payment-service', () => ({
	checkout: mockCheckout
}));

const {
	createCheckoutSession,
	getSubscription,
	updateQuantity,
	cancel,
	createBillingPortalUrl,
	resume
} = await import('./subscription-service');

// ---------------------------------------------------------------------------
// createCheckoutSession
// ---------------------------------------------------------------------------
describe('createCheckoutSession', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('delegates to shared checkout with subscription mode', async () => {
		mockCheckout.mockResolvedValue({
			paid: false,
			checkoutUrl: 'https://checkout.stripe.com/sub_sess'
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
		expect(mockCheckout).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: 'user-1',
				stripeCustomerId: 'cus_123',
				mode: 'subscription',
				lineItems: [expect.objectContaining({
					price_data: expect.objectContaining({
						currency: 'usd',
						product: 'prod_contribution',
						recurring: { interval: 'month' }
					}),
					quantity: 5
				})],
				coverFees: false,
				metadata: expect.objectContaining({
					subscription_type: 'contribution'
				}),
				successUrl: 'https://example.com/success',
				cancelUrl: 'https://example.com/cancel'
			})
		);
	});

	it('passes coverFees through to shared checkout', async () => {
		mockCheckout.mockResolvedValue({
			paid: false,
			checkoutUrl: 'https://checkout.stripe.com/sub_fee'
		});

		await createCheckoutSession({
			userId: 'user-1',
			stripeCustomerId: 'cus_123',
			quantity: 3,
			coverFees: true,
			successUrl: 'https://example.com/success',
			cancelUrl: 'https://example.com/cancel'
		});

		expect(mockCheckout).toHaveBeenCalledWith(
			expect.objectContaining({ coverFees: true })
		);
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

	it('throws when checkout returns no URL', async () => {
		mockCheckout.mockResolvedValue({ paid: true });

		await expect(createCheckoutSession({
			userId: 'user-1',
			stripeCustomerId: 'cus_123',
			quantity: 5,
			coverFees: false,
			successUrl: 'https://example.com/success',
			cancelUrl: 'https://example.com/cancel'
		})).rejects.toThrow('Stripe did not return a checkout URL');
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
				cancel_at_period_end: false,
				items: {
					data: [
						{ price: { id: 'price_contribution', product: 'prod_contribution' }, quantity: 5, current_period_end: 1700000000 },
						{ price: { id: 'price_auto_fee', product: 'prod_fee' }, quantity: 1, current_period_end: 1700000000 }
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
				cancel_at_period_end: true,
				items: {
					data: [
						{ price: { id: 'price_contribution', product: 'prod_contribution' }, quantity: 3, current_period_end: 1700000000 }
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

	it('updates contribution quantity and adds fee item via price_data', async () => {
		mockStripe.subscriptions.list.mockResolvedValue({
			data: [{
				id: 'sub_upd',
				items: {
					data: [
						{ id: 'si_contrib', price: { id: 'price_contribution', product: 'prod_contribution' }, quantity: 3 }
					]
				}
			}]
		});

		await updateQuantity('cus_123', 7, true);

		expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_upd', {
			items: expect.arrayContaining([
				{ id: 'si_contrib', quantity: 7 },
				expect.objectContaining({
					price_data: expect.objectContaining({
						currency: 'usd',
						product: 'prod_fee',
						recurring: { interval: 'month' }
					}),
					quantity: 1
				})
			])
		});

		// Fee amount should be positive
		const call = mockStripe.subscriptions.update.mock.calls[0][1];
		const feeItem = call.items.find((i: any) => i.price_data);
		expect(feeItem.price_data.unit_amount).toBeGreaterThan(0);
	});

	it('removes existing fee item before adding new one', async () => {
		mockStripe.subscriptions.list.mockResolvedValue({
			data: [{
				id: 'sub_replace_fee',
				items: {
					data: [
						{ id: 'si_contrib', price: { id: 'price_contribution', product: 'prod_contribution' }, quantity: 5 },
						{ id: 'si_old_fee', price: { id: 'price_old_fee', product: 'prod_fee' }, quantity: 1 }
					]
				}
			}]
		});

		await updateQuantity('cus_123', 10, true);

		const call = mockStripe.subscriptions.update.mock.calls[0][1];
		// Should delete old fee item
		expect(call.items).toContainEqual({ id: 'si_old_fee', deleted: true });
		// Should add new fee item with price_data
		const newFee = call.items.find((i: any) => i.price_data);
		expect(newFee).toBeDefined();
	});

	it('removes fee item when coverFees is false', async () => {
		mockStripe.subscriptions.list.mockResolvedValue({
			data: [{
				id: 'sub_rm_fee',
				items: {
					data: [
						{ id: 'si_contrib', price: { id: 'price_contribution', product: 'prod_contribution' }, quantity: 5 },
						{ id: 'si_fee', price: { id: 'price_fee_coverage', product: 'prod_fee' }, quantity: 1 }
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

// ---------------------------------------------------------------------------
// createBillingPortalUrl
// ---------------------------------------------------------------------------
describe('createBillingPortalUrl', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('creates a billing portal session and returns the URL', async () => {
		mockStripe.billingPortal.sessions.create.mockResolvedValue({
			url: 'https://billing.stripe.com/session/abc'
		});

		const url = await createBillingPortalUrl('cus_123', 'https://example.com/return');

		expect(url).toBe('https://billing.stripe.com/session/abc');
		expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith({
			customer: 'cus_123',
			return_url: 'https://example.com/return'
		});
	});

	it('returns null when no customer ID is provided', async () => {
		expect(await createBillingPortalUrl(null, 'https://example.com')).toBeNull();
		expect(await createBillingPortalUrl(undefined, 'https://example.com')).toBeNull();
		expect(mockStripe.billingPortal.sessions.create).not.toHaveBeenCalled();
	});
});
