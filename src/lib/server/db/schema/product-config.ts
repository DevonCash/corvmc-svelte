import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { timestamp, type Serialized } from './columns';

// @deprecated — Pricing config is migrating to KV site config. See product-config-service.ts.
export const productConfig = sqliteTable('product_config', {
	key: text('key').primaryKey(),
	stripeProductId: text('stripe_product_id'),
	name: text('name').notNull(),
	description: text('description'),
	unitAmountCents: integer('unit_amount_cents').notNull().default(0),
	unitLabel: text('unit_label'),
	createdAt: timestamp('created_at').notNull().default(sql`(current_timestamp)`),
	updatedAt: timestamp('updated_at').notNull().default(sql`(current_timestamp)`)
});

export type ProductConfig = Serialized<typeof productConfig.$inferSelect>;
