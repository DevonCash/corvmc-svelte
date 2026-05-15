import { pgTable, text, timestamp, uuid, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const recurringSeries = pgTable(
	'recurring_series',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		supersededBy: uuid('superseded_by'),
		prototypeType: text('prototype_type').notNull(),
		prototypeId: uuid('prototype_id').notNull(),
		rrule: text('rrule').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		cancelledAt: timestamp('cancelled_at', { withTimezone: true })
	},
	(t) => [
		// Self-referential FK added via migration SQL (Drizzle can't reference same table inline)
		index('idx_recurring_series_active').on(t.prototypeType).where(
			sql`cancelled_at IS NULL AND superseded_by IS NULL`
		),
		index('idx_recurring_series_prototype').on(t.prototypeType, t.prototypeId)
	]
);
