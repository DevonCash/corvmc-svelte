import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Stripe SDK
// ---------------------------------------------------------------------------
const mockStripe = {
	prices: {
		retrieve: vi.fn()
	},
	coupons: {
		create: vi.fn()
	},
	checkout: {
		sessions: {
			create: vi.fn(),
			retrieve: vi.fn()
		}
	},
	paymentRecords: {
		reportPayment: vi.fn(),
		retrieve: vi.fn(),
		reportRefund: vi.fn()
	}
};

vi.mock('$lib/server/stripe', () => ({
	stripe: mockStripe
}));

// ---------------------------------------------------------------------------
// Mock CreditService
// ---------------------------------------------------------------------------
const mockCreditService = {
	getBalance: vi.fn(),
	deductCredits: vi.fn(),
	addCredits: vi.fn()
};

vi.mock('./credit-service', () => mockCreditService);

// Import after mocking
const { checkout, onCheckoutComplete, recordCashPayment, refund, cancel } = await import('./payment-service');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makePrice(unitAmount: number, eligibleWallets: string) {
	return {
		unit_amount: unitAmount,
		product: {
			metadata: { eligible_wallets: eligibleWallets }
		}
	};
}

// ---------------------------------------------------------------------------
// checkout()
// ---------------------------------------------------------------------------
describe('checkout', () => {
	const baseOptions = {
		userId: 'user-1',
		stripeCustomerId: 'cus_123',
		stripePriceId: 'price_abc',
		quantity: 3,
		purchasableType: 'reservation',
		purchasableId: 'res-1',
		successUrl: 'https://example.com/success',
		cancelUrl: 'https://example.com/cancel'
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('creates Checkout Session with no coupon when user has no credits', async () => {
		mockStripe.prices.retrieve.mockResolvedValue(makePrice(1000, 'free_hours'));
		mockCreditService.getBalance.mockResolvedValue(0);
		mockStripe.checkout.sessions.create.mockResolvedValue({
			url: 'https://checkout.stripe.com/sess_123'
		});

		const result = await checkout(baseOptions);

		expect(result).toEqual({ paid: false, checkoutUrl: 'https://checkout.stripe.com/sess_123' });
		expect(mockCreditService.deductCredits).not.toHaveBeenCalled();
		expect(mockStripe.coupons.create).not.toHaveBeenCalled();
		expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
			expect.objectContaining({
				customer: 'cus_123',
				mode: 'payment',
				line_items: [{ price: 'price_abc', quantity: 3 }],
				metadata: expect.objectContaining({
					credits_applied_cents: '0',
					credits_breakdown: '[]',
					purchasable_type: 'reservation',
					purchasable_id: 'res-1'
				})
			})
		);
	});

	it('creates Checkout Session with coupon when user has partial credits', async () => {
		mockStripe.prices.retrieve.mockResolvedValue(makePrice(1000, 'free_hours'));
		mockCreditService.getBalance.mockResolvedValue(2);
		mockCreditService.deductCredits.mockResolvedValue(0);
		mockStripe.coupons.create.mockResolvedValue({ id: 'coupon_abc' });
		mockStripe.checkout.sessions.create.mockResolvedValue({
			url: 'https://checkout.stripe.com/sess_456'
		});

		const result = await checkout(baseOptions);

		expect(result).toEqual({ paid: false, checkoutUrl: 'https://checkout.stripe.com/sess_456' });
		expect(mockCreditService.deductCredits).toHaveBeenCalledWith(
			'user-1', 'free_hours', 2, 'checkout', 'res-1', expect.any(String)
		);
		expect(mockStripe.coupons.create).toHaveBeenCalledWith(
			expect.objectContaining({ amount_off: 2000, currency: 'usd', max_redemptions: 1 })
		);
		expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
			expect.objectContaining({
				discounts: [{ coupon: 'coupon_abc' }],
				metadata: expect.objectContaining({
					credits_applied_cents: '2000',
					credits_breakdown: JSON.stringify([{ type: 'free_hours', units: 2, cents: 2000 }])
				})
			})
		);
	});

	it('returns paid: true when credits fully cover the price', async () => {
		mockStripe.prices.retrieve.mockResolvedValue(makePrice(1000, 'free_hours'));
		mockCreditService.getBalance.mockResolvedValue(5);
		mockCreditService.deductCredits.mockResolvedValue(2);
		mockStripe.paymentRecords.reportPayment.mockResolvedValue({ id: 'pr_credits_only' });

		const result = await checkout(baseOptions);

		expect(result).toEqual({ paid: true, stripePaymentRecordId: 'pr_credits_only' });
		expect(mockCreditService.deductCredits).toHaveBeenCalledWith(
			'user-1', 'free_hours', 3, 'checkout', 'res-1', expect.any(String)
		);
		expect(mockStripe.paymentRecords.reportPayment).toHaveBeenCalledWith(
			expect.objectContaining({
				amount_requested: { value: 0, currency: 'usd' },
				metadata: expect.objectContaining({
					credits_applied_cents: '3000',
					credits_breakdown: JSON.stringify([{ type: 'free_hours', units: 3, cents: 3000 }])
				})
			})
		);
		expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
	});

	it('ignores credits when product has no eligible_wallets', async () => {
		mockStripe.prices.retrieve.mockResolvedValue(makePrice(1000, ''));
		mockStripe.checkout.sessions.create.mockResolvedValue({
			url: 'https://checkout.stripe.com/sess_789'
		});

		const result = await checkout(baseOptions);

		expect(result).toEqual({ paid: false, checkoutUrl: 'https://checkout.stripe.com/sess_789' });
		expect(mockCreditService.getBalance).not.toHaveBeenCalled();
		expect(mockCreditService.deductCredits).not.toHaveBeenCalled();
	});

	it('ignores ineligible credit types', async () => {
		mockStripe.prices.retrieve.mockResolvedValue(makePrice(1000, 'equipment_credits'));
		mockCreditService.getBalance.mockResolvedValue(0);
		mockStripe.checkout.sessions.create.mockResolvedValue({
			url: 'https://checkout.stripe.com/sess_eq'
		});

		const result = await checkout(baseOptions);

		expect(result).toEqual({ paid: false, checkoutUrl: 'https://checkout.stripe.com/sess_eq' });
		expect(mockCreditService.getBalance).toHaveBeenCalledWith('user-1', 'equipment_credits');
		expect(mockCreditService.deductCredits).not.toHaveBeenCalled();
	});

	it('reverses completed deductions if a subsequent one fails', async () => {
		// Product eligible for both wallet types
		mockStripe.prices.retrieve.mockResolvedValue(makePrice(1000, 'free_hours,equipment_credits'));
		mockCreditService.getBalance
			.mockResolvedValueOnce(2)  // free_hours: 2 available
			.mockResolvedValueOnce(1); // equipment_credits: 1 available
		mockCreditService.deductCredits
			.mockResolvedValueOnce(0)  // free_hours deduction succeeds
			.mockRejectedValueOnce(new Error('DB error')); // equipment_credits fails
		mockCreditService.addCredits.mockResolvedValue(2);

		await expect(checkout(baseOptions)).rejects.toThrow('DB error');

		// The successful free_hours deduction should be reversed
		expect(mockCreditService.addCredits).toHaveBeenCalledWith(
			'user-1', 'free_hours', 2, 'checkout_failed', 'res-1', expect.any(String)
		);
	});
});

// ---------------------------------------------------------------------------
// onCheckoutComplete()
// ---------------------------------------------------------------------------
describe('onCheckoutComplete', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns purchasable info and payment record ID', async () => {
		mockStripe.checkout.sessions.retrieve.mockResolvedValue({
			id: 'cs_123',
			metadata: { purchasable_type: 'reservation', purchasable_id: 'res-42' },
			payment_intent: { id: 'pi_abc' }
		});

		const result = await onCheckoutComplete('cs_123');
		expect(result).toEqual({
			purchasableType: 'reservation',
			purchasableId: 'res-42',
			paymentRecordId: 'pi_abc'
		});
	});

	it('throws when metadata is missing', async () => {
		mockStripe.checkout.sessions.retrieve.mockResolvedValue({ id: 'cs_bad', metadata: {} });
		await expect(onCheckoutComplete('cs_bad')).rejects.toThrow('missing purchasable metadata');
	});
});

// ---------------------------------------------------------------------------
// recordCashPayment()
// ---------------------------------------------------------------------------
describe('recordCashPayment', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('reports payment to Stripe with correct amount and metadata', async () => {
		mockStripe.paymentRecords.reportPayment.mockResolvedValue({ id: 'pr_cash_1' });

		const result = await recordCashPayment({
			userId: 'user-1',
			stripeCustomerId: 'cus_123',
			amountCents: 2500,
			purchasableType: 'reservation',
			purchasableId: 'res-5'
		});

		expect(result).toEqual({ paymentRecordId: 'pr_cash_1' });
		expect(mockStripe.paymentRecords.reportPayment).toHaveBeenCalledWith(
			expect.objectContaining({
				amount_requested: { value: 2500, currency: 'usd' },
				metadata: expect.objectContaining({
					purchasable_type: 'reservation',
					purchasable_id: 'res-5'
				})
			})
		);
	});
});

// ---------------------------------------------------------------------------
// refund()
// ---------------------------------------------------------------------------
describe('refund', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('refunds card payment and reverses credits using stored breakdown', async () => {
		mockStripe.paymentRecords.retrieve.mockResolvedValue({
			amount: { value: 1000 },
			metadata: {
				credits_applied_cents: '2000',
				credits_breakdown: JSON.stringify([{ type: 'free_hours', units: 2, cents: 2000 }])
			}
		});
		mockStripe.paymentRecords.reportRefund.mockResolvedValue({});
		mockCreditService.addCredits.mockResolvedValue(2);

		await refund({
			userId: 'user-1',
			purchasableType: 'reservation',
			purchasableId: 'res-1',
			stripePaymentRecordId: 'pr_123'
		});

		expect(mockStripe.paymentRecords.reportRefund).toHaveBeenCalledWith(
			'pr_123',
			expect.objectContaining({ amount: { value: 1000, currency: 'usd' } })
		);
		expect(mockCreditService.addCredits).toHaveBeenCalledWith(
			'user-1', 'free_hours', 2, 'refund', 'pr_123', expect.any(String)
		);
	});

	it('only reverses credits for credits-only payment', async () => {
		mockStripe.paymentRecords.retrieve.mockResolvedValue({
			amount: { value: 0 },
			metadata: {
				credits_applied_cents: '3000',
				credits_breakdown: JSON.stringify([{ type: 'free_hours', units: 3, cents: 3000 }])
			}
		});
		mockCreditService.addCredits.mockResolvedValue(3);

		await refund({
			userId: 'user-1',
			purchasableType: 'reservation',
			purchasableId: 'res-2',
			stripePaymentRecordId: 'pr_456'
		});

		expect(mockStripe.paymentRecords.reportRefund).not.toHaveBeenCalled();
		expect(mockCreditService.addCredits).toHaveBeenCalledWith(
			'user-1', 'free_hours', 3, 'refund', 'pr_456', expect.any(String)
		);
	});

	it('reverses equipment_credits when that wallet was used', async () => {
		mockStripe.paymentRecords.retrieve.mockResolvedValue({
			amount: { value: 0 },
			metadata: {
				credits_applied_cents: '500',
				credits_breakdown: JSON.stringify([{ type: 'equipment_credits', units: 1, cents: 500 }])
			}
		});
		mockCreditService.addCredits.mockResolvedValue(1);

		await refund({
			userId: 'user-1',
			purchasableType: 'equipment_loan',
			purchasableId: 'loan-1',
			stripePaymentRecordId: 'pr_eq'
		});

		expect(mockCreditService.addCredits).toHaveBeenCalledWith(
			'user-1', 'equipment_credits', 1, 'refund', 'pr_eq', expect.any(String)
		);
	});

	it('does nothing when no credits were applied and no payment amount', async () => {
		mockStripe.paymentRecords.retrieve.mockResolvedValue({
			amount: { value: 0 },
			metadata: {}
		});

		await refund({
			userId: 'user-1',
			purchasableType: 'reservation',
			purchasableId: 'res-3',
			stripePaymentRecordId: 'pr_empty'
		});

		expect(mockStripe.paymentRecords.reportRefund).not.toHaveBeenCalled();
		expect(mockCreditService.addCredits).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// cancel()
// ---------------------------------------------------------------------------
describe('cancel', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('reverses optimistically deducted credits using stored breakdown', async () => {
		mockStripe.checkout.sessions.retrieve.mockResolvedValue({
			metadata: {
				credits_applied_cents: '1000',
				credits_breakdown: JSON.stringify([{ type: 'free_hours', units: 1, cents: 1000 }])
			}
		});
		mockCreditService.addCredits.mockResolvedValue(1);

		await cancel({
			userId: 'user-1',
			purchasableType: 'reservation',
			purchasableId: 'res-3',
			stripeCheckoutSessionId: 'cs_abandoned'
		});

		expect(mockCreditService.addCredits).toHaveBeenCalledWith(
			'user-1', 'free_hours', 1, 'cancelled', 'cs_abandoned', expect.any(String)
		);
	});

	it('does nothing when no checkout session ID provided', async () => {
		await cancel({
			userId: 'user-1',
			purchasableType: 'reservation',
			purchasableId: 'res-4'
		});

		expect(mockStripe.checkout.sessions.retrieve).not.toHaveBeenCalled();
		expect(mockCreditService.addCredits).not.toHaveBeenCalled();
	});

	it('does nothing when no credits were deducted', async () => {
		mockStripe.checkout.sessions.retrieve.mockResolvedValue({
			metadata: { credits_applied_cents: '0' }
		});

		await cancel({
			userId: 'user-1',
			purchasableType: 'reservation',
			purchasableId: 'res-5',
			stripeCheckoutSessionId: 'cs_no_credits'
		});

		expect(mockCreditService.addCredits).not.toHaveBeenCalled();
	});
});
