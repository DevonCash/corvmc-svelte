import { pgTable, serial, text, integer, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const creditTransaction = pgTable(
	'credit_transaction',
	{
		id: serial('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		creditType: text('credit_type').notNull(),
		amount: integer('amount').notNull(),
		balanceAfter: integer('balance_after').notNull(),
		source: text('source').notNull(),
		sourceId: text('source_id'),
		description: text('description').notNull(),
		metadata: jsonb('metadata').notNull().default({}),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('credit_transaction_user_idx').on(t.userId),
		index('credit_transaction_user_type_idx').on(t.userId, t.creditType)
	]
);
