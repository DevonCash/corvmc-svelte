import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockStripe = {
	customers: {
		create: vi.fn()
	}
};

vi.mock('$lib/server/stripe', () => ({
	stripe: mockStripe
}));

let selectResult: unknown[] = [];
const mockDbSelect = vi.fn().mockImplementation(() => ({
	from: vi.fn().mockReturnValue({
		where: vi.fn().mockReturnValue({
			limit: vi.fn().mockImplementation(() => Promise.resolve(selectResult))
		})
	})
}));

const mockDbUpdateSet = vi.fn().mockReturnValue({
	where: vi.fn().mockResolvedValue(undefined)
});
const mockDbUpdate = vi.fn().mockReturnValue({
	set: mockDbUpdateSet
});

vi.mock('$lib/server/db', () => ({
	db: {
		select: (...args: any[]) => mockDbSelect(...args),
		update: (...args: any[]) => mockDbUpdate(...args)
	}
}));

vi.mock('$lib/server/db/schema/authentication', () => ({
	user: { id: 'id', stripeId: 'stripe_id' }
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn()
}));

const { ensureStripeCustomer } = await import('./stripe-customer-service');

describe('ensureStripeCustomer', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns existing stripeId without calling Stripe', async () => {
		selectResult = [{ stripeId: 'cus_existing' }];

		const result = await ensureStripeCustomer('user-1', 'test@example.com');

		expect(result).toBe('cus_existing');
		expect(mockStripe.customers.create).not.toHaveBeenCalled();
		expect(mockDbUpdate).not.toHaveBeenCalled();
	});

	it('creates customer and updates DB when stripeId is null', async () => {
		selectResult = [{ stripeId: null }];
		mockStripe.customers.create.mockResolvedValue({ id: 'cus_new' });

		const result = await ensureStripeCustomer('user-1', 'test@example.com');

		expect(result).toBe('cus_new');
		expect(mockStripe.customers.create).toHaveBeenCalledWith({
			email: 'test@example.com',
			name: undefined,
			metadata: { userId: 'user-1' }
		});
		expect(mockDbUpdate).toHaveBeenCalled();
	});

	it('passes name to Stripe when provided', async () => {
		selectResult = [{ stripeId: null }];
		mockStripe.customers.create.mockResolvedValue({ id: 'cus_named' });

		await ensureStripeCustomer('user-1', 'test@example.com', 'Jane Doe');

		expect(mockStripe.customers.create).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'Jane Doe' })
		);
	});
});
