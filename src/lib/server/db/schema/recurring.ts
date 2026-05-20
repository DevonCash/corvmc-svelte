import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { timestamp, uuid, type Serialized } from './columns';

// ---------------------------------------------------------------------------
// Recurring domain types
// ---------------------------------------------------------------------------

export const RECURRING_FREQUENCIES = ['weekly', 'biweekly', 'monthly'] as const;
export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number];

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const recurringSeries = sqliteTable(
	'recurring_series',
	{
		id: uuid('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
		supersededBy: text('superseded_by'),
		prototypeType: text('prototype_type').notNull(),
		prototypeId: text('prototype_id').notNull(),
		rrule: text('rrule').notNull(),
		createdAt: timestamp('created_at').notNull().default(sql`(current_timestamp)`),
		cancelledAt: timestamp('cancelled_at')
	},
	(t) => [
		index('idx_recurring_series_active').on(t.prototypeType).where(
			sql`cancelled_at IS NULL AND superseded_by IS NULL`
		),
		index('idx_recurring_series_prototype').on(t.prototypeType, t.prototypeId)
	]
);

// ---------------------------------------------------------------------------
// Client-safe serialized types
// ---------------------------------------------------------------------------

export type RecurringSeries = Serialized<typeof recurringSeries.$inferSelect>;
