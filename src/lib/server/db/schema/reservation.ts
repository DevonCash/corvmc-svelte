import { pgTable, text, timestamp, uuid, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './auth';
import { recurringSeries } from './recurring';

export const reservation = pgTable(
	'reservation',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		bookerType: text('booker_type').notNull(),
		bookerId: text('booker_id').notNull(),
		createdByUserId: text('created_by_user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		status: text('status').notNull().default('scheduled'),
		startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
		endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
		notes: text('notes'),
		cancellationReason: text('cancellation_reason'),
		stripePaymentRecordId: text('stripe_payment_record_id'),
		lockAccessId: text('lock_access_id'),
		recurringSeriesId: uuid('recurring_series_id').references(() => recurringSeries.id, {
			onDelete: 'set null'
		}),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('idx_reservation_conflict').on(t.startsAt, t.endsAt),
		index('idx_reservation_user').on(t.createdByUserId, t.status),
		index('idx_reservation_booker').on(t.bookerType, t.bookerId),
		index('idx_reservation_recurring')
			.on(t.recurringSeriesId, t.startsAt)
			.where(sql`recurring_series_id IS NOT NULL`),
		check('reservation_time_order', sql`ends_at > starts_at`)
	]
);

export const closure = pgTable(
	'closure',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		reason: text('reason').notNull(),
		startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
		endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('idx_closure_time').on(t.startsAt, t.endsAt),
		check('closure_time_order', sql`ends_at > starts_at`)
	]
);
