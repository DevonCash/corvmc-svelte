import { sqliteTable, text, integer, index, unique } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { user } from './authentication';

// ---------------------------------------------------------------------------
// Notification type registry
// ---------------------------------------------------------------------------

export interface NotificationTypeDef {
	key: string;
	label: string;
	description: string;
	defaults: {
		email: boolean;
		inApp: boolean;
		sms: boolean;
	};
	mandatory?: boolean;
}

export const NOTIFICATION_TYPES: NotificationTypeDef[] = [
	{
		key: 'ticket_confirmation',
		label: 'Ticket purchase confirmation',
		description: 'Confirmation email with your ticket codes after purchase',
		defaults: { email: true, inApp: true, sms: false },
		mandatory: true
	},
	{
		key: 'event_cancellation',
		label: 'Event cancellation',
		description: 'Notification when an event you have tickets for is cancelled',
		defaults: { email: true, inApp: true, sms: false },
		mandatory: true
	},
	{
		key: 'check_in_reminder',
		label: 'Event check-in reminder',
		description: 'Reminder before an event with your ticket code',
		defaults: { email: true, inApp: true, sms: false }
	},
	{
		key: 'reservation_reminder',
		label: 'Reservation reminder',
		description: 'Reminder about upcoming reservations',
		defaults: { email: true, inApp: true, sms: false }
	},
	{
		key: 'confirmation_reminder',
		label: 'Confirmation reminder',
		description: 'Reminder to confirm unconfirmed reservations',
		defaults: { email: true, inApp: true, sms: false }
	},
	{
		key: 'band_invitation',
		label: 'Band invitation',
		description: 'Notification when someone invites you to their band',
		defaults: { email: true, inApp: true, sms: false }
	},
	{
		key: 'band_invitation_accepted',
		label: 'Band invitation accepted',
		description: 'Notification when someone accepts your band invitation',
		defaults: { email: true, inApp: true, sms: false }
	},
	{
		key: 'recurring_skipped',
		label: 'Recurring reservation skipped',
		description: 'Notification when a recurring reservation is skipped due to a conflict',
		defaults: { email: true, inApp: true, sms: false }
	},
	{
		key: 'recurring_waitlisted',
		label: 'Recurring reservation waitlisted',
		description:
			'Notification when a recurring reservation instance is waitlisted due to a conflict',
		defaults: { email: true, inApp: true, sms: false }
	},
	{
		key: 'waitlist_slot_available',
		label: 'Waitlist slot available',
		description:
			'Notification when a waitlisted reservation slot becomes available for confirmation',
		defaults: { email: true, inApp: true, sms: false },
		mandatory: true
	},
	{
		key: 'waitlist_expired',
		label: 'Waitlist expired',
		description: 'Notification when a waitlisted reservation expires without confirmation',
		defaults: { email: true, inApp: true, sms: false }
	},
	{
		key: 'equipment_loan_scheduled',
		label: 'Equipment loan confirmed',
		description: 'Notification when staff confirms your equipment pickup',
		defaults: { email: true, inApp: true, sms: false }
	},
	{
		key: 'equipment_loan_requested',
		label: 'Equipment loan requested (staff)',
		description: 'Notification when a member requests equipment',
		defaults: { email: true, inApp: true, sms: false }
	},
	{
		key: 'equipment_checked_out',
		label: 'Equipment checked out',
		description: 'Confirmation when you check out equipment',
		defaults: { email: true, inApp: true, sms: false }
	},
	{
		key: 'equipment_returned',
		label: 'Equipment returned',
		description: 'Summary when your equipment return is recorded',
		defaults: { email: true, inApp: true, sms: false }
	},
	{
		key: 'reservation_cancelled',
		label: 'Reservation cancelled',
		description: 'Notification when your reservation is cancelled by staff',
		defaults: { email: true, inApp: true, sms: false }
	},
	{
		key: 'contact_form',
		label: 'Contact form submission',
		description: 'Forwarded contact form messages (staff only)',
		defaults: { email: true, inApp: false, sms: false },
		mandatory: true
	},
	{
		key: 'inbox_message_received',
		label: 'New inbox message (staff)',
		description: 'Notification when a new message arrives in the staff inbox',
		defaults: { email: false, inApp: true, sms: false }
	},
	{
		key: 'content_flagged',
		label: 'Content flagged (staff)',
		description: 'Notification when a member reports a profile for review',
		defaults: { email: false, inApp: true, sms: false }
	}
];

export function getNotificationType(key: string): NotificationTypeDef | undefined {
	return NOTIFICATION_TYPES.find((t) => t.key === key);
}

// ---------------------------------------------------------------------------
// In-app notifications
// ---------------------------------------------------------------------------

export const notification = sqliteTable(
	'notification',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		type: text('type').notNull(),
		title: text('title').notNull(),
		body: text('body'),
		href: text('href'),
		data: text('data', { mode: 'json' }),
		readAt: integer('read_at', { mode: 'timestamp' }),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`)
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
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		notificationType: text('notification_type').notNull(),
		emailEnabled: integer('email_enabled', { mode: 'boolean' }).notNull().default(true),
		inAppEnabled: integer('in_app_enabled', { mode: 'boolean' }).notNull().default(true),
		smsEnabled: integer('sms_enabled', { mode: 'boolean' }).notNull().default(false),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`)
	},
	(t) => [
		unique('uq_notification_pref_user_type').on(t.userId, t.notificationType),
		index('idx_notification_pref_user').on(t.userId)
	]
);

export type Notification = typeof notification.$inferSelect;
