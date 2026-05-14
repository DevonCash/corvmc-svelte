import { pgTable, text, timestamp, uuid, index } from 'drizzle-orm/pg-core';
import { user } from './auth';
import { event } from './event';

export const ticket = pgTable(
	'ticket',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		eventId: uuid('event_id')
			.notNull()
			.references(() => event.id, { onDelete: 'cascade' }),
		purchaseId: uuid('purchase_id').notNull(),
		userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
		attendeeName: text('attendee_name').notNull(),
		attendeeEmail: text('attendee_email').notNull(),
		code: text('code').notNull().unique(),
		status: text('status').notNull().default('pending'),
		checkedInAt: timestamp('checked_in_at', { withTimezone: true }),
		checkedInByUserId: text('checked_in_by_user_id').references(() => user.id, {
			onDelete: 'set null'
		}),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('idx_ticket_event').on(t.eventId),
		index('idx_ticket_purchase').on(t.purchaseId),
		index('idx_ticket_user').on(t.userId),
		index('idx_ticket_event_status').on(t.eventId, t.status)
	]
);
