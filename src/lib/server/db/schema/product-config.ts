import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// @deprecated — Pricing config is migrating to KV site config. See product-config-service.ts.
export const productConfig = sqliteTable('product_config', {
	key: text('key').primaryKey(),
	stripeProductId: text('stripe_product_id'),
	name: text('name').notNull(),
	description: text('description'),
	unitAmountCents: integer('unit_amount_cents').notNull().default(0),
	unitLabel: text('unit_label'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

export type ProductConfig = typeof productConfig.$inferSelect;
