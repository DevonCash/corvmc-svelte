import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let selectResults: unknown[][] = [];
let selectCallIndex = 0;
const insertedRows: unknown[] = [];
let updateData: unknown[] = [];

function buildChain() {
	const proxy: any = new Proxy(() => proxy, {
		get(_, prop) {
			if (prop === 'then') {
				const result = selectResults[selectCallIndex] ?? [];
				selectCallIndex++;
				return (resolve: (v: unknown[]) => void) => resolve(result);
			}
			if (prop === 'onConflictDoNothing') {
				return () => ({
					returning: () => {
						const result = selectResults[selectCallIndex] ?? [];
						selectCallIndex++;
						return Promise.resolve(result);
					}
				});
			}
			return () => proxy;
		}
	});
	return proxy;
}

vi.mock('$lib/server/db', () => ({
	db: {
		select: () => buildChain(),
		insert: () => ({
			values: (row: unknown) => {
				insertedRows.push(row);
				return {
					onConflictDoNothing: () => ({
						returning: () => {
							const result = selectResults[selectCallIndex] ?? [];
							selectCallIndex++;
							return Promise.resolve(result);
						}
					}),
					returning: () => Promise.resolve([row])
				};
			}
		}),
		update: () => {
			const chain: any = new Proxy(() => chain, {
				get(_, prop) {
					if (prop === 'set')
						return (data: unknown) => {
							updateData.push(data);
							return chain;
						};
					if (prop === 'returning')
						return () => Promise.resolve([{ key: 'contribution', name: 'Updated' }]);
					if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(undefined);
					return () => chain;
				}
			});
			return chain;
		}
	}
}));

vi.mock('$lib/server/db/schema/product-config', () => ({
	productConfig: {
		key: 'key',
		stripeProductId: 'stripe_product_id',
		name: 'name',
		description: 'description',
		unitAmountCents: 'unit_amount_cents',
		unitLabel: 'unit_label'
	}
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn()
}));

const mockStripeProducts = {
	create: vi.fn().mockResolvedValue({ id: 'prod_new_123' }),
	update: vi.fn().mockResolvedValue({ id: 'prod_existing' })
};

vi.mock('$lib/server/stripe', () => ({
	stripe: {
		products: {
			create: (...args: unknown[]) => mockStripeProducts.create(...args),
			update: (...args: unknown[]) => mockStripeProducts.update(...args)
		}
	}
}));

const {
	getProductConfig,
	getStripeProductId,
	updateProductConfig,
	buildLineItem,
	buildSubscriptionLineItem
} = await import('./product-config-service');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	vi.clearAllMocks();
	selectResults = [];
	selectCallIndex = 0;
	insertedRows.length = 0;
	updateData = [];
});

describe('getProductConfig', () => {
	it('returns existing row from database', async () => {
		const row = {
			key: 'contribution',
			stripeProductId: 'prod_123',
			name: 'Practice Room',
			description: 'Hourly',
			unitAmountCents: 1500,
			unitLabel: 'per hour'
		};
		selectResults.push([row]);

		const result = await getProductConfig('contribution');

		expect(result).toEqual(row);
	});

	it('seeds from defaults when row does not exist', async () => {
		// First select: no row
		selectResults.push([]);
		// insert.onConflictDoNothing.returning: returns created row
		selectResults.push([
			{
				key: 'contribution',
				stripeProductId: null,
				name: 'Practice Room Rental',
				description: 'Hourly practice room rental at the Corvallis Music Collective',
				unitAmountCents: 1500,
				unitLabel: 'per hour'
			}
		]);

		const result = await getProductConfig('contribution');

		expect(result.name).toBe('Practice Room Rental');
		expect(result.unitAmountCents).toBe(1500);
	});
});

describe('getStripeProductId', () => {
	it('returns existing stripe product ID', async () => {
		selectResults.push([
			{
				key: 'contribution',
				stripeProductId: 'prod_existing',
				name: 'Practice Room',
				description: null,
				unitAmountCents: 1500,
				unitLabel: 'per hour'
			}
		]);

		const result = await getStripeProductId('contribution');

		expect(result).toBe('prod_existing');
		expect(mockStripeProducts.create).not.toHaveBeenCalled();
	});

	it('creates Stripe product when none exists', async () => {
		selectResults.push([
			{
				key: 'contribution',
				stripeProductId: null,
				name: 'Practice Room',
				description: 'Hourly rental',
				unitAmountCents: 1500,
				unitLabel: 'per hour'
			}
		]);

		const result = await getStripeProductId('contribution');

		expect(result).toBe('prod_new_123');
		expect(mockStripeProducts.create).toHaveBeenCalledWith(
			expect.objectContaining({
				name: 'Practice Room',
				description: 'Hourly rental',
				metadata: { corvmc_key: 'contribution' }
			})
		);
	});
});

describe('updateProductConfig', () => {
	it('updates local config and syncs to Stripe when product exists', async () => {
		selectResults.push([
			{
				key: 'contribution',
				stripeProductId: 'prod_123',
				name: 'Old Name',
				description: 'Old desc',
				unitAmountCents: 1500,
				unitLabel: 'per hour'
			}
		]);

		await updateProductConfig('contribution', { name: 'New Name', description: 'New desc' });

		expect(updateData[0]).toMatchObject({ name: 'New Name', description: 'New desc' });
		expect(mockStripeProducts.update).toHaveBeenCalledWith('prod_123', {
			name: 'New Name',
			description: 'New desc'
		});
	});

	it('skips Stripe sync when no Stripe product exists', async () => {
		selectResults.push([
			{
				key: 'contribution',
				stripeProductId: null,
				name: 'Old',
				description: null,
				unitAmountCents: 1500,
				unitLabel: 'per hour'
			}
		]);

		await updateProductConfig('contribution', { name: 'Updated' });

		expect(mockStripeProducts.update).not.toHaveBeenCalled();
	});

	it('skips Stripe sync when name/description unchanged', async () => {
		selectResults.push([
			{
				key: 'contribution',
				stripeProductId: 'prod_123',
				name: 'Same',
				description: 'Same',
				unitAmountCents: 1500,
				unitLabel: 'per hour'
			}
		]);

		await updateProductConfig('contribution', { unitAmountCents: 2000 });

		expect(mockStripeProducts.update).not.toHaveBeenCalled();
	});
});

describe('buildLineItem', () => {
	it('returns a line item with price_data', async () => {
		// getStripeProductId -> getProductConfig
		selectResults.push([
			{
				key: 'contribution',
				stripeProductId: 'prod_123',
				name: 'Room',
				description: null,
				unitAmountCents: 1500,
				unitLabel: 'per hour'
			}
		]);

		const item = await buildLineItem('contribution', 1500, 2);

		expect(item).toEqual({
			price_data: {
				currency: 'usd',
				product: 'prod_123',
				unit_amount: 1500
			},
			quantity: 2
		});
	});
});

describe('buildSubscriptionLineItem', () => {
	it('includes recurring interval in price_data', async () => {
		selectResults.push([
			{
				key: 'contribution',
				stripeProductId: 'prod_sub',
				name: 'Monthly',
				description: null,
				unitAmountCents: 500,
				unitLabel: 'per month'
			}
		]);

		const item = await buildSubscriptionLineItem('contribution', 500, 1, 'month');

		expect(item.price_data!.recurring).toEqual({ interval: 'month' });
	});
});
