import { pgTable, text, timestamp, uuid, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './auth';
import { reservation } from './reservation';

export const event = pgTable(
	'event',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		title: text('title').notNull(),
		description: text('description'),
		startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
		endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
		doorsAt: timestamp('doors_at', { withTimezone: true }),
		status: text('status').notNull().default('draft'),
		publishedAt: timestamp('published_at', { withTimezone: true }),
		reservationId: uuid('reservation_id').references(() => reservation.id),
		posterKey: text('poster_key'),
		tags: text('tags'),
		createdByUserId: text('created_by_user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('idx_event_status_starts').on(t.status, t.startsAt),
		index('idx_event_reservation').on(t.reservationId),
		check('event_time_order', sql`ends_at > starts_at`)
	]
);
