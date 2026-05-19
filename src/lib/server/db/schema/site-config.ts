import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { timestamp } from './columns';

export const siteConfig = sqliteTable('site_config', {
	key: text('key').primaryKey(),
	value: text('value').notNull(),
	createdAt: timestamp('created_at').notNull().default(sql`(current_timestamp)`),
	updatedAt: timestamp('updated_at').notNull().default(sql`(current_timestamp)`)
});
