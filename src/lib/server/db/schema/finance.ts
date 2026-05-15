import { pgTable, serial, text, uuid, integer, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { user } from './auth';
import { reservation } from './reservation';

// ---------------------------------------------------------------------------
// Payment record cache — mirrors Stripe Payment Records created by our app
// ---------------------------------------------------------------------------

export const paymentRecord = pgTable(
	'payment_record',
	{
		id: text('id').primaryKey(), // Stripe payment record ID (pr_...)
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		reservationId: uuid('reservation_id').references(() => reservation.id, {
			onDelete: 'set null'
		}),
		stripeCustomerId: text('stripe_customer_id'),
		amountCents: integer('amount_cents').notNull(),
		currency: text('currency').notNull().default('usd'),
		paymentMethod: text('payment_method').notNull(), // 'Cash' | 'Credits'
		status: text('status').notNull().default('completed'), // 'completed' | 'refunded'
		paidAt: timestamp('paid_at', { withTimezone: true }).notNull(),
		refundedAt: timestamp('refunded_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
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
