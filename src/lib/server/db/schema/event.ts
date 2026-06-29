import { sqliteTable, text, integer, index, uniqueIndex, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { user } from './authentication';
import { band } from './band';
import { reservation } from './reservation';
import { recurringSeries, RECURRING_FREQUENCIES } from './recurring';

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
		recurringSeriesId: text('recurring_series_id').references(() => recurringSeries.id, {
			onDelete: 'set null'
		}),
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
		index('idx_event_recurring_series').on(t.recurringSeriesId),
		uniqueIndex('uq_event_recurring_instance')
			.on(t.recurringSeriesId, t.startsAt)
			.where(sql`recurring_series_id IS NOT NULL AND status != 'cancelled'`),
		check('event_time_order', sql`ends_at > starts_at`)
	]
);

// ---------------------------------------------------------------------------
// Form schemas
// ---------------------------------------------------------------------------

export const createEventSchema = z
	.object({
		title: z.string().min(1, 'Title is required'),
		description: z.string().optional(),
		eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
		eventStartTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time'),
		eventEndTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time'),
		doorsTime: z.string().optional(),
		tags: z.string().optional(),
		ticketingEnabled: z.boolean().default(false),
		ticketPrice: z.string().optional(),
		ticketQuantity: z.string().optional(),
		reserveSpace: z.boolean().default(false),
		reservationStartTime: z.string().optional(),
		reservationEndTime: z.string().optional(),
		overrideConflicts: z.boolean().default(false),
		recurring: z.boolean().default(false),
		recurringFrequency: z.enum(RECURRING_FREQUENCIES).optional(),
		monthlyMode: z.enum(['weekday', 'monthday']).optional(),
		// Allow empty (unset) or a YYYY-MM-DD date; empty is normalized in the handler.
		recurringEndsAt: z
			.string()
			.regex(/^$|^\d{4}-\d{2}-\d{2}$/, 'Invalid date')
			.optional()
	})
	.superRefine((data, ctx) => {
		// Ticketing requires a positive price. Surfacing this here turns what would
		// otherwise be a thrown Error in the event service (→ 500 "Internal Error")
		// into a graceful form validation failure.
		if (data.ticketingEnabled) {
			const cents = data.ticketPrice ? parseInt(data.ticketPrice, 10) : NaN;
			if (!Number.isFinite(cents) || cents <= 0) {
				ctx.addIssue({
					code: 'custom',
					path: ['ticketPrice'],
					message: 'Ticket price is required when ticketing is enabled'
				});
			}
		}

		// A recurring series needs a frequency to expand.
		if (data.recurring && !data.recurringFrequency) {
			ctx.addIssue({
				code: 'custom',
				path: ['recurringFrequency'],
				message: 'Choose how often the event repeats'
			});
		}
	});

// ---------------------------------------------------------------------------
// Client-safe serialized types
// ---------------------------------------------------------------------------

export type Event = typeof event.$inferSelect;
