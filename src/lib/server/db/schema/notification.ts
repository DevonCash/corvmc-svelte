import { sqliteTable, text, integer, index, unique } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { timestamp, uuid, zodJson } from './columns';
import { z } from 'zod';
import { user } from './auth';

// ---------------------------------------------------------------------------
// In-app notifications
// ---------------------------------------------------------------------------

export const notification = sqliteTable(
	'notification',
	{
		id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		type: text('type').notNull(),
		title: text('title').notNull(),
		body: text('body'),
		href: text('href'),
		data: zodJson(z.record(z.string(), z.unknown()).nullable().default(null))('data'),
		readAt: timestamp('read_at'),
		createdAt: timestamp('created_at').notNull().default(sql`(current_timestamp)`)
	},
	(t) => [
		index('idx_notification_user').on(t.userId),
		index('idx_notification_user_unread').on(t.userId, t.readAt)
	]
);

// ---------------------------------------------------------------------------
// Notification preferences
// ---------------------------------------------------------------------------

export const notificationPreference = sqliteTable(
	'notification_preference',
	{
		id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		notificationType: text('notification_type').notNull(),
		emailEnabled: integer('email_enabled', { mode: 'boolean' }).notNull().default(true),
		inAppEnabled: integer('in_app_enabled', { mode: 'boolean' }).notNull().default(true),
		smsEnabled: integer('sms_enabled', { mode: 'boolean' }).notNull().default(false),
		createdAt: timestamp('created_at').notNull().default(sql`(current_timestamp)`),
		updatedAt: timestamp('updated_at').notNull().default(sql`(current_timestamp)`)
	},
	(t) => [
		unique('uq_notification_pref_user_type').on(t.userId, t.notificationType),
		index('idx_notification_pref_user').on(t.userId)
	]
);
