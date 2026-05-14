import { pgTable, text, timestamp, uuid, jsonb, index, boolean, unique } from 'drizzle-orm/pg-core';
import { user } from './auth';

// ---------------------------------------------------------------------------
// In-app notifications
// ---------------------------------------------------------------------------
// Persistent notifications shown in the bell dropdown. Each notification
// targets a single user and has a type (used for preference lookups),
// human-readable title/body, optional link, and optional structured data.
// ---------------------------------------------------------------------------

export const notification = pgTable(
	'notification',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		type: text('type').notNull(),
		title: text('title').notNull(),
		body: text('body'),
		href: text('href'),
		data: jsonb('data'),
		readAt: timestamp('read_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('idx_notification_user').on(t.userId),
		index('idx_notification_user_unread').on(t.userId, t.readAt)
	]
);

// ---------------------------------------------------------------------------
// Notification preferences
// ---------------------------------------------------------------------------
// Per-user, per-notification-type channel selection. If no row exists for
// a (user, type) pair, the notification type's default channels are used.
// ---------------------------------------------------------------------------

export const notificationPreference = pgTable(
	'notification_preference',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		notificationType: text('notification_type').notNull(),
		emailEnabled: boolean('email_enabled').notNull().default(true),
		inAppEnabled: boolean('in_app_enabled').notNull().default(true),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		unique('uq_notification_pref_user_type').on(t.userId, t.notificationType),
		index('idx_notification_pref_user').on(t.userId)
	]
);
