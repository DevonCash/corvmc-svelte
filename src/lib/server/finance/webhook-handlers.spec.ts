import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Stripe from 'stripe';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
let userQueryResults: unknown[] = [];

function chainable() {
	const proxy: any = new Proxy(() => proxy, {
		get(_, prop) {
			if (prop === 'then') {
				return (resolve: (v: unknown[]) => void) => resolve(userQueryResults);
			}
			return () => proxy;
		}
	});
	return proxy;
}

vi.mock('$lib/server/db', () => ({
	db: {
		select: () => chainable(),
		update: () => chainable()
	}
}));

const mockCreditService = {
	allocateMonthlyCredits: vi.fn(),
	setBalance: vi.fn()
};
vi.mock('./credit-service', () => mockCreditService);

const {
	handleCheckoutCompleted,
	handleInvoicePaid,
	handleSubscriptionDeleted,
	onCheckoutComplete
} = await import('./webhook-handlers');

// ---------------------------------------------------------------------------
// handleCheckoutCompleted
// ---------------------------------------------------------------------------
describe('handleCheckoutCompleted', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		userQueryResults = [];
	});

	it('calls registered listeners with the session', async () => {
		const listener = vi.fn();
		onCheckoutComplete(listener);

		const session = { id: 'cs_123', metadata: { reservation_id: 'res-42' } } as unknown as Stripe.Checkout.Session;
		await handleCheckoutCompleted(session);

		expect(listener).toHaveBeenCalledWith(session);
	});

	it('calls multiple listeners in order', async () => {
		const order: string[] = [];
		const listenerA = vi.fn(async () => { order.push('A'); });
		const listenerB = vi.fn(async () => { order.push('B'); });

		onCheckoutComplete(listenerA);
		onCheckoutComplete(listenerB);

		await handleCheckoutCompleted({ id: 'cs_multi' } as Stripe.Checkout.Session);

		expect(order).toContain('A');
		expect(order).toContain('B');
		expect(listenerA).toHaveBeenCalled();
		expect(listenerB).toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// handleInvoicePaid
// ---------------------------------------------------------------------------
describe('handleInvoicePaid', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		userQueryResults = [];
	});

	it('allocates monthly credits based on subscription quantity', async () => {
		userQueryResults = [{ id: 'user-1' }];
		mockCreditService.allocateMonthlyCredits.mockResolvedValue(5);

		const invoice = {
			id: 'inv_123',
			parent: {
				subscription_details: { subscription: 'sub_abc' }
			},
			customer: 'cus_123',
			lines: {
				data: [
					{ parent: { subscription_item_details: { subscription_item: 'si_abc' } }, quantity: 5, amount: 2500 }
				]
			}
		} as unknown as Stripe.Invoice;

		await handleInvoicePaid(invoice);

		expect(mockCreditService.allocateMonthlyCredits).toHaveBeenCalledWith(
			'user-1', 5, 'inv_123'
		);
	});

	it('handles customer as an object with id property', async () => {
		userQueryResults = [{ id: 'user-2' }];
		mockCreditService.allocateMonthlyCredits.mockResolvedValue(3);

		const invoice = {
			id: 'inv_obj_cus',
			parent: {
				subscription_details: { subscription: { id: 'sub_obj' } }
			},
			customer: { id: 'cus_456' },
			lines: {
				data: [
					{ parent: { subscription_item_details: { subscription_item: 'si_obj' } }, quantity: 3, amount: 1500 }
				]
			}
		} as unknown as Stripe.Invoice;

		await handleInvoicePaid(invoice);

		expect(mockCreditService.allocateMonthlyCredits).toHaveBeenCalledWith(
			'user-2', 3, 'inv_obj_cus'
		);
	});

	it('skips non-subscription invoices', async () => {
		const invoice = {
			id: 'inv_one_time',
			parent: { subscription_details: null },
			customer: 'cus_123'
		} as unknown as Stripe.Invoice;

		await handleInvoicePaid(invoice);

		expect(mockCreditService.allocateMonthlyCredits).not.toHaveBeenCalled();
	});

	it('skips lines without subscription_item_details', async () => {
		userQueryResults = [{ id: 'user-1' }];
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const invoice = {
			id: 'inv_proration',
			parent: {
				subscription_details: { subscription: 'sub_abc' }
			},
			customer: 'cus_123',
			lines: {
				data: [
					{ parent: { subscription_item_details: null }, quantity: 1, amount: 100 }
				]
			}
		} as unknown as Stripe.Invoice;

		await handleInvoicePaid(invoice);

		expect(mockCreditService.allocateMonthlyCredits).not.toHaveBeenCalled();
		warnSpy.mockRestore();
	});

	it('warns when no user found for customer', async () => {
		userQueryResults = [];
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const invoice = {
			id: 'inv_orphan',
			parent: {
				subscription_details: { subscription: 'sub_xyz' }
			},
			customer: 'cus_unknown',
			lines: { data: [{ parent: { subscription_item_details: { subscription_item: 'si_xyz' } }, quantity: 3 }] }
		} as unknown as Stripe.Invoice;

		await handleInvoicePaid(invoice);

		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('no user found'));
		expect(mockCreditService.allocateMonthlyCredits).not.toHaveBeenCalled();
		warnSpy.mockRestore();
	});
});

// ---------------------------------------------------------------------------
// handleSubscriptionDeleted
// ---------------------------------------------------------------------------
describe('handleSubscriptionDeleted', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		userQueryResults = [];
	});

	it('resets free_hours balance to 0', async () => {
		userQueryResults = [{ id: 'user-1' }];
		mockCreditService.setBalance.mockResolvedValue(0);

		const subscription = {
			id: 'sub_cancelled',
			customer: 'cus_123'
		} as unknown as Stripe.Subscription;

		await handleSubscriptionDeleted(subscription);

		expect(mockCreditService.setBalance).toHaveBeenCalledWith(
			'user-1',
			'free_hours',
			0,
			'monthly_allocation',
			'sub_cancelled',
			expect.any(String)
		);
	});

	it('warns when no user found for customer', async () => {
		userQueryResults = [];
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const subscription = {
			id: 'sub_orphan',
			customer: 'cus_ghost'
		} as unknown as Stripe.Subscription;

		await handleSubscriptionDeleted(subscription);

		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('no user found'));
		expect(mockCreditService.setBalance).not.toHaveBeenCalled();
		warnSpy.mockRestore();
	});
});
