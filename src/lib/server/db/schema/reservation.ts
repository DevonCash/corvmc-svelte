import { sqliteTable, text, index, uniqueIndex, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { timestamp, uuid, type Serialized } from './columns';
import { user } from './auth';
import { recurringSeries } from './recurring';

// ---------------------------------------------------------------------------
// Reservation domain types
// ---------------------------------------------------------------------------

export const bookerTypes = ['user', 'band', 'event', 'lesson'] as const;
export type BookerType = (typeof bookerTypes)[number];

export function isBookerType(value: string): value is BookerType {
	return bookerTypes.includes(value as BookerType);
}

export const reservationStatuses = ['scheduled', 'confirmed', 'completed', 'no_show', 'cancelled'] as const;
export type ReservationStatus = (typeof reservationStatuses)[number];

export interface TimeSlot {
	startTime: string;
	endTime: string;
	available: boolean;
}

export const createReservationSchema = z.object({
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
	startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
	endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
	notes: z.string().optional()
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>;

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const reservation = sqliteTable(
	'reservation',
	{
		id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
		bookerType: text('booker_type').notNull(),
		bookerId: text('booker_id').notNull(),
		createdByUserId: text('created_by_user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		status: text('status').notNull().default('scheduled'),
		startsAt: timestamp('starts_at').notNull(),
		endsAt: timestamp('ends_at').notNull(),
		notes: text('notes'),
		cancellationReason: text('cancellation_reason'),
		stripePaymentRecordId: text('stripe_payment_record_id'),
		lockAccessId: text('lock_access_id'),
		recurringSeriesId: text('recurring_series_id').references(() => recurringSeries.id, {
			onDelete: 'set null'
		}),
		createdAt: timestamp('created_at').notNull().default(sql`(current_timestamp)`),
		updatedAt: timestamp('updated_at').notNull().default(sql`(current_timestamp)`)
	},
	(t) => [
		index('idx_reservation_conflict').on(t.startsAt, t.endsAt),
		index('idx_reservation_user').on(t.createdByUserId, t.status),
		index('idx_reservation_booker').on(t.bookerType, t.bookerId),
		uniqueIndex('uq_recurring_instance')
			.on(t.recurringSeriesId, t.startsAt)
			.where(sql`recurring_series_id IS NOT NULL AND status != 'cancelled'`),
		check('reservation_time_order', sql`ends_at > starts_at`)
	]
);

export const closure = sqliteTable(
	'closure',
	{
		id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
		reason: text('reason').notNull(),
		startsAt: timestamp('starts_at').notNull(),
		endsAt: timestamp('ends_at').notNull(),
		createdAt: timestamp('created_at').notNull().default(sql`(current_timestamp)`)
	},
	(t) => [
		index('idx_closure_time').on(t.startsAt, t.endsAt),
		check('closure_time_order', sql`ends_at > starts_at`)
	]
);

// ---------------------------------------------------------------------------
// Client-safe serialized types
// ---------------------------------------------------------------------------

export type Reservation = Serialized<typeof reservation.$inferSelect>;
export type Closure = Serialized<typeof closure.$inferSelect>;
