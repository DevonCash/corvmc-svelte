import { sqliteTable, text, integer, index, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { timestamp, uuid } from './columns';
import { user } from './auth';
import { reservation } from './reservation';

export const event = sqliteTable(
	'event',
	{
		id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
		title: text('title').notNull(),
		description: text('description'),
		startsAt: timestamp('starts_at').notNull(),
		endsAt: timestamp('ends_at').notNull(),
		doorsAt: timestamp('doors_at'),
		status: text('status').notNull().default('draft'),
		publishedAt: timestamp('published_at'),
		reservationId: text('reservation_id').references(() => reservation.id),
		posterKey: text('poster_key'),
		tags: text('tags'),
		ticketingEnabled: integer('ticketing_enabled', { mode: 'boolean' }).notNull().default(false),
		ticketPrice: integer('ticket_price'),
		ticketQuantity: integer('ticket_quantity'),
		createdByUserId: text('created_by_user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		createdAt: timestamp('created_at').notNull().default(sql`(current_timestamp)`),
		updatedAt: timestamp('updated_at').notNull().default(sql`(current_timestamp)`)
	},
	(t) => [
		index('idx_event_status_starts').on(t.status, t.startsAt),
		index('idx_event_reservation').on(t.reservationId),
		check('event_time_order', sql`ends_at > starts_at`)
	]
);