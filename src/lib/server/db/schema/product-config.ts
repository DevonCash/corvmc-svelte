import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core';

/**
 * Stores Stripe product configuration. Each row represents a product type
 * (e.g. 'contribution', 'rehearsal', 'fee_coverage') with its display info
 * and pricing. The stripe_product_id is auto-populated on first use.
 *
 * All pricing uses inline price_data at checkout time — no stored Stripe
 * Price objects. Changing unit_amount_cents takes effect immediately on the
 * next checkout without any Stripe-side price management.
 */
export const productConfig = pgTable('product_config', {
	/** Internal key: 'contribution', 'rehearsal', 'fee_coverage' */
	key: text('key').primaryKey(),
	/** Stripe product ID, auto-created on first checkout */
	stripeProductId: text('stripe_product_id'),
	/** Display name shown in Stripe and on invoices */
	name: text('name').notNull(),
	/** Product description shown in Stripe */
	description: text('description'),
	/** Price per unit in cents. Meaning depends on product type:
	 *  - contribution: per unit per month ($5 = 500)
	 *  - rehearsal: per hour ($15 = 1500)
	 *  - fee_coverage: not used (computed per-checkout)
	 */
	unitAmountCents: integer('unit_amount_cents').notNull().default(0),
	/** Human-readable label for the unit, e.g. "per month", "per hour" */
	unitLabel: text('unit_label'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});
