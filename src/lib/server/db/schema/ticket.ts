import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { timestamp, uuid, type Serialized } from './columns';
import { user } from './auth';
import { event } from './event';

export const ticket = sqliteTable(
	'ticket',
	{
		id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
		eventId: text('event_id')
			.notNull()
			.references(() => event.id, { onDelete: 'cascade' }),
		purchaseId: text('purchase_id').notNull(),
		userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
		attendeeName: text('attendee_name').notNull(),
		attendeeEmail: text('attendee_email').notNull(),
		code: text('code').notNull().unique(),
		status: text('status').notNull().default('pending'),
		checkedInAt: timestamp('checked_in_at'),
		checkedInByUserId: text('checked_in_by_user_id').references(() => user.id, {
			onDelete: 'set null'
		}),
		createdAt: timestamp('created_at').notNull().default(sql`(current_timestamp)`),
		updatedAt: timestamp('updated_at').notNull().default(sql`(current_timestamp)`)
	},
	(t) => [
		index('idx_ticket_event').on(t.eventId),
		index('idx_ticket_purchase').on(t.purchaseId),
		index('idx_ticket_user').on(t.userId),
		index('idx_ticket_event_status').on(t.eventId, t.status)
	]
);

// ---------------------------------------------------------------------------
// Client-safe serialized types
// ---------------------------------------------------------------------------

export type Ticket = Serialized<typeof ticket.$inferSelect>;