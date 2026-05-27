import { sqliteTable, text, integer, index, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { user } from './authentication';
import { band } from './band';
import { reservation } from './reservation';

export const eventStatuses = ['draft', 'published', 'cancelled'] as const;
export type EventStatus = (typeof eventStatuses)[number];

export const eventSources = ['cmc', 'band'] as const;
export type EventSource = (typeof eventSources)[number];

export const event = sqliteTable(
	'event',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		title: text('title').notNull(),
		description: text('description'),
		startsAt: integer('starts_at', { mode: 'timestamp' }).notNull(),
		endsAt: integer('ends_at', { mode: 'timestamp' }).notNull(),
		doorsAt: integer('doors_at', { mode: 'timestamp' }),
		status: text('status', { enum: eventStatuses }).notNull().default('draft'),
		publishedAt: integer('published_at', { mode: 'timestamp' }),
		reservationId: text('reservation_id').references(() => reservation.id),
		posterKey: text('poster_key'),
		tags: text('tags'),
		ticketingEnabled: integer('ticketing_enabled', { mode: 'boolean' }).notNull().default(false),
		ticketPrice: integer('ticket_price'),
		ticketQuantity: integer('ticket_quantity'),
		bandId: text('band_id').references(() => band.id, { onDelete: 'set null' }),
		source: text('source', { enum: eventSources }).notNull().default('cmc'),
		location: text('location'),
		externalTicketUrl: text('external_ticket_url'),
		createdByUserId: text('created_by_user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`)
	},
	(t) => [
		index('idx_event_status_starts').on(t.status, t.startsAt),
		index('idx_event_reservation').on(t.reservationId),
		index('idx_event_band').on(t.bandId),
		index('idx_event_source').on(t.source, t.status, t.startsAt),
		check('event_time_order', sql`ends_at > starts_at`)
	]
);

// ---------------------------------------------------------------------------
// Client-safe serialized types
// ---------------------------------------------------------------------------

export type Event = typeof event.$inferSelect;
