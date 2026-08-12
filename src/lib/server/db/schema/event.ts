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
		// Nullable: a band backfilling old gigs rarely knows when the night ended,
		// and inventing one would bake fiction into their history. CMC events still
		// require it — enforced by the event_cmc_needs_end check below.
		endsAt: integer('ends_at', { mode: 'timestamp' }),
		doorsAt: integer('doors_at', { mode: 'timestamp' }),
		status: text('status', { enum: eventStatuses }).notNull().default('draft'),
		publishedAt: integer('published_at', { mode: 'timestamp' }),
		reservationId: text('reservation_id').references(() => reservation.id),
		posterKey: text('poster_key'),
		tags: text('tags'),
		ticketingEnabled: integer('ticketing_enabled', { mode: 'boolean' }).notNull().default(false),
		ticketPrice: integer('ticket_price'),
		ticketQuantity: integer('ticket_quantity'),
		// The band that OWNS this event — whose panel it lives in, and the only band
		// that may edit, publish or cancel it. Null for CMC-produced events. This is
		// not the bill: who actually played is `event_band`, and every write that sets
		// bandId must also write the matching confirmed event_band row.
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
		// Passes when ends_at is NULL: `NULL > x` is NULL, and a CHECK passes on NULL.
		check('event_time_order', sql`ends_at > starts_at`),
		check('event_cmc_needs_end', sql`source = 'band' OR ends_at IS NOT NULL`)
	]
);

// ---------------------------------------------------------------------------
// Event lineup (the bill)
// ---------------------------------------------------------------------------

/**
 * Where a lineup row sits between "just a credit" and "a link to a real band".
 *
 * Invariant: `unlinked` ⇔ `bandId IS NULL`. Everything else has a bandId.
 *
 * - unlinked  — a name with no account behind it. The common case: most acts on
 *               a bill, especially in backfilled history, aren't CMC members.
 * - pending   — points at a platform band that hasn't agreed yet.
 * - confirmed — the band agreed. Only these reach that band's own profile.
 * - declined  — the band said no. Keeps its bandId so the partial unique index
 *               below blocks the owner from re-adding and re-pinging them; it
 *               renders exactly like an unlinked credit.
 */
export const eventBandStatuses = ['unlinked', 'pending', 'confirmed', 'declined'] as const;
export type EventBandStatus = (typeof eventBandStatuses)[number];

/**
 * Who played, as opposed to who manages the record (that is `event.bandId`).
 *
 * A row is always a *name*; the band link is optional. That split is the whole
 * point — listing an off-platform band must not require an account, and listing
 * a platform band must not write to that band's profile without their consent.
 *
 * Rendering splits by direction:
 *   on the event    — every row shows, but only `confirmed` links to the band
 *   on B's profile  — only `confirmed` appears at all
 */
export const eventBand = sqliteTable(
	'event_band',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		eventId: text('event_id')
			.notNull()
			.references(() => event.id, { onDelete: 'cascade' }),
		/** Display credit. Always set, even when bandId is. */
		name: text('name').notNull(),
		/** Set only when this credit points at a real band. */
		bandId: text('band_id').references(() => band.id, { onDelete: 'cascade' }),
		/** 0 = headliner, ascending down the bill. */
		billingOrder: integer('billing_order').notNull().default(0),
		status: text('status', { enum: eventBandStatuses }).notNull().default('unlinked'),
		/** Optional slot label, e.g. "Direct support". */
		note: text('note'),
		addedByBandId: text('added_by_band_id').references(() => band.id, { onDelete: 'set null' }),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`)
	},
	(t) => [
		// Partial: many unlinked credits per event are fine, but a given band can
		// only appear once — which is also what makes `declined` stick.
		uniqueIndex('uq_event_band_event_band')
			.on(t.eventId, t.bandId)
			.where(sql`band_id IS NOT NULL`),
		index('idx_event_band_band_status').on(t.bandId, t.status),
		index('idx_event_band_event_order').on(t.eventId, t.billingOrder)
	]
);

export type EventBand = typeof eventBand.$inferSelect;

/** One act on the bill, as submitted by a lineup editor. */
export const lineupEntrySchema = z.object({
	name: z.string().trim().min(1, 'Name is required').max(200),
	bandId: z.string().optional(),
	billingOrder: z.number().int().min(0).max(11),
	note: z.string().max(100).optional()
});

/** A whole bill. Capped so one event can't fan out unbounded invites. */
export const lineupSchema = z.array(lineupEntrySchema).max(12, 'At most 12 acts on a bill');

export type LineupEntry = z.infer<typeof lineupEntrySchema>;

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
