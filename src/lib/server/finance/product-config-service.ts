// @deprecated — The product_config table is deprecated. Pricing config is
// migrating to KV site config (see site-config-service.ts). The 'rehearsal'
// product has been fully migrated to reservation.hourlyRateCents in KV.
// Remaining products (contribution, fee_coverage, ticket) will follow.
import { db } from '$lib/server/db';
import { productConfig } from '$lib/server/db/schema/product-config';
import { stripe } from '$lib/server/stripe';
import { eq } from 'drizzle-orm';
import type { CheckoutLineItem } from './payment-service';

// ---------------------------------------------------------------------------
// Product config defaults — used to seed the table on first access
// ---------------------------------------------------------------------------

export type ProductKey = 'contribution' | 'rehearsal' | 'fee_coverage' | 'ticket' | 'band_premium';

interface ProductDefault {
	name: string;
	description: string;
	unitAmountCents: number;
	unitLabel: string;
}

const DEFAULTS: Record<ProductKey, ProductDefault> = {
	contribution: {
		name: 'Monthly Contribution',
		description: 'Recurring membership contribution to the Corvallis Music Collective',
		unitAmountCents: 500,
		unitLabel: 'per unit/month'
	},
	rehearsal: {
		name: 'Practice Room Rental',
		description: 'Hourly practice room rental at the Corvallis Music Collective',
		unitAmountCents: 1500,
		unitLabel: 'per hour'
	},
	fee_coverage: {
		name: 'Processing Fee Coverage',
		description: 'Optional fee to cover payment processing costs',
		unitAmountCents: 0,
		unitLabel: 'per transaction'
	},
	ticket: {
		name: 'Event Ticket',
		description: 'Ticket for a Corvallis Music Collective event',
		unitAmountCents: 0,
		unitLabel: 'per ticket'
	},
	band_premium: {
		name: 'Band Premium Page',
		description: 'Premium band page with subdomain, block editor, and EPK features',
		unitAmountCents: 1500,
		unitLabel: 'per month'
	}
};

// ---------------------------------------------------------------------------
// Core access
// ---------------------------------------------------------------------------

export interface ProductConfigRow {
	key: string;
	stripeProductId: string | null;
	name: string;
	description: string | null;
	unitAmountCents: number;
	unitLabel: string | null;
}

/**
 * Get a product config row, creating it from defaults if it doesn't exist.
 */
export async function getProductConfig(key: ProductKey): Promise<ProductConfigRow> {
	const [row] = await db
		.select()
		.from(productConfig)
		.where(eq(productConfig.key, key))
		.limit(1);

	if (row) return row;

	// Seed from defaults
	const defaults = DEFAULTS[key];
	const [created] = await db
		.insert(productConfig)
		.values({
			key,
			name: defaults.name,
			description: defaults.description,
			unitAmountCents: defaults.unitAmountCents,
			unitLabel: defaults.unitLabel
		})
		.onConflictDoNothing()
		.returning();

	// Could have been created by a concurrent request
	if (!created) {
		const [existing] = await db
			.select()
			.from(productConfig)
			.where(eq(productConfig.key, key))
			.limit(1);
		return existing;
	}

	return created;
}

/**
 * Get all product configs, seeding any missing ones from defaults.
 */
export async function getAllProductConfigs(): Promise<ProductConfigRow[]> {
	const keys: ProductKey[] = ['contribution', 'rehearsal', 'fee_coverage', 'ticket', 'band_premium'];
	const configs: ProductConfigRow[] = [];

	for (const key of keys) {
		configs.push(await getProductConfig(key));
	}

	return configs;
}

// ---------------------------------------------------------------------------
// Stripe product auto-creation
// ---------------------------------------------------------------------------

/**
 * Get the Stripe product ID for a product key, creating the Stripe product
 * if it doesn't exist yet.
 */
export async function getStripeProductId(key: ProductKey): Promise<string> {
	const config = await getProductConfig(key);

	if (config.stripeProductId) return config.stripeProductId;

	// Create in Stripe
	const product = await stripe.products.create({
		name: config.name,
		...(config.description && { description: config.description }),
		metadata: { corvmc_key: key }
	});

	// Store the ID
	await db
		.update(productConfig)
		.set({ stripeProductId: product.id, updatedAt: new Date() })
		.where(eq(productConfig.key, key));

	return product.id;
}

// ---------------------------------------------------------------------------
// Line item builders
// ---------------------------------------------------------------------------

/**
 * Build a checkout line item for a one-time charge using inline pricing.
 */
export async function buildLineItem(
	key: ProductKey,
	unitAmountCents: number,
	quantity: number
): Promise<CheckoutLineItem> {
	const productId = await getStripeProductId(key);

	return {
		price_data: {
			currency: 'usd',
			product: productId,
			unit_amount: unitAmountCents
		},
		quantity
	};
}

/**
 * Build a checkout line item for a recurring subscription using inline pricing.
 */
export async function buildSubscriptionLineItem(
	key: ProductKey,
	unitAmountCents: number,
	quantity: number,
	interval: string = 'month'
): Promise<CheckoutLineItem> {
	const productId = await getStripeProductId(key);

	return {
		price_data: {
			currency: 'usd',
			product: productId,
			unit_amount: unitAmountCents,
			recurring: { interval }
		},
		quantity
	};
}

// ---------------------------------------------------------------------------
// Updates
// ---------------------------------------------------------------------------

export interface UpdateProductConfigInput {
	name?: string;
	description?: string | null;
	unitAmountCents?: number;
}

/**
 * Update a product config row. If the name or description changed and
 * a Stripe product exists, sync the changes to Stripe.
 */
export async function updateProductConfig(
	key: ProductKey,
	input: UpdateProductConfigInput
): Promise<ProductConfigRow> {
	const current = await getProductConfig(key);

	const updates: Record<string, unknown> = { updatedAt: new Date() };
	if (input.name !== undefined) updates.name = input.name;
	if (input.description !== undefined) updates.description = input.description;
	if (input.unitAmountCents !== undefined) updates.unitAmountCents = input.unitAmountCents;

	const [updated] = await db
		.update(productConfig)
		.set(updates)
		.where(eq(productConfig.key, key))
		.returning();

	// Sync name/description to Stripe if the product exists
	if (current.stripeProductId) {
		const stripeUpdates: Record<string, string> = {};
		if (input.name !== undefined && input.name !== current.name) {
			stripeUpdates.name = input.name;
		}
		if (input.description !== undefined && input.description !== current.description) {
			stripeUpdates.description = input.description ?? '';
		}

		if (Object.keys(stripeUpdates).length > 0) {
			await stripe.products.update(current.stripeProductId, stripeUpdates);
		}
	}

	return updated;
}
