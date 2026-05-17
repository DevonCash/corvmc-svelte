import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';
import { timestamp, zodJson } from './columns';
import { z } from 'zod';
import { user } from './auth';
import { reservation } from './reservation';

// ---------------------------------------------------------------------------
// Payment record cache — mirrors Stripe Payment Records created by our app
// ---------------------------------------------------------------------------

export const paymentCache = sqliteTable(
	'payment_cache',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		reservationId: text('reservation_id').references(() => reservation.id, {
			onDelete: 'set null'
		}),
		stripeCustomerId: text('stripe_customer_id'),
		amountCents: integer('amount_cents').notNull(),
		currency: text('currency').notNull().default('usd'),
		paymentMethod: text('payment_method').notNull(),
		status: text('status').notNull().default('completed'),
		paidAt: timestamp('paid_at').notNull(),
		refundedAt: timestamp('refunded_at'),
		createdAt: timestamp('created_at').notNull().default(sql`(current_timestamp)`)
	},
	(t) => [
		index('idx_payment_record_user').on(t.userId),
		index('idx_payment_record_reservation').on(t.reservationId),
		index('idx_payment_record_paid_at').on(t.paidAt)
	]
);

// ---------------------------------------------------------------------------
// Credit transactions
// ---------------------------------------------------------------------------

export const creditTransaction = sqliteTable(
	'credit_transaction',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		creditType: text('credit_type').notNull(),
		amount: integer('amount').notNull(),
		balanceAfter: integer('balance_after').notNull(),
		source: text('source').notNull(),
		sourceId: text('source_id'),
		description: text('description').notNull(),
		metadata: zodJson(z.record(z.string(), z.unknown()).default({}))('metadata'),
		createdAt: timestamp('created_at').notNull().default(sql`(current_timestamp)`)
	},
	(t) => [
		index('credit_transaction_user_idx').on(t.userId),
		index('credit_transaction_user_type_idx').on(t.userId, t.creditType)
	]
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const paymentCacheRelations = relations(paymentCache, ({ one }) => ({
	user: one(user, { fields: [paymentCache.userId], references: [user.id] }),
	reservation: one(reservation, { fields: [paymentCache.reservationId], references: [reservation.id] }),
}));

export const creditTransactionRelations = relations(creditTransaction, ({ one }) => ({
	user: one(user, { fields: [creditTransaction.userId], references: [user.id] }),
}));
