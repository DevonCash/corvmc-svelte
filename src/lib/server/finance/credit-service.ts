import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/auth';
import { creditTransaction } from '$lib/server/db/schema/finance';
import { eq, and, sql } from 'drizzle-orm';
import {
	parseCredits,
	getBalance as getBalanceFromCredits,
	isCreditType,
	creditTypeConfig,
	type CreditType,
	type Credits
} from './types';

// ---------------------------------------------------------------------------
// CreditService — reads and writes credit balances
// ---------------------------------------------------------------------------
// All write operations run in a transaction: update user.credits + insert
// credit_transaction. The JSONB updates use Postgres jsonb_set with a balance
// check in the WHERE clause to prevent concurrent over-spending.
//
// Credits column shape: { "free_hours": 4, "equipment_credits": 12 }
// ---------------------------------------------------------------------------

export class InsufficientCreditsError extends Error {
	constructor(type: CreditType, requested: number, available: number) {
		super(`Insufficient ${type}: requested ${requested}, available ${available}`);
		this.name = 'InsufficientCreditsError';
	}
}

/** Validate creditType at runtime before using in raw SQL. */
function assertCreditType(type: string): asserts type is CreditType {
	if (!isCreditType(type)) {
		throw new Error(`Invalid credit type: ${type}`);
	}
}

/** Read the balance for a single credit type. Returns 0 if the user has no credits of that type. */
export async function getBalance(userId: string, creditType: CreditType): Promise<number> {
	const credits = await getAllBalances(userId);
	return getBalanceFromCredits(credits, creditType);
}

/** Read the full credits object for a user. */
export async function getAllBalances(userId: string): Promise<Credits> {
	const [row] = await db
		.select({ credits: user.credits })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);

	if (!row) return {};
	return parseCredits(row.credits);
}

/** Add credits to a user's balance. Respects maxBalance cap from config. */
export async function addCredits(
	userId: string,
	creditType: CreditType,
	amount: number,
	source: string,
	sourceId?: string,
	description?: string
): Promise<number> {
	if (amount <= 0) throw new Error('Amount must be positive');
	assertCreditType(creditType);

	return db.transaction(async (tx) => {
		// SELECT ... FOR UPDATE to prevent lost writes from concurrent addCredits
		const [row] = await tx.execute(sql`
			SELECT credits FROM "user" WHERE id = ${userId} FOR UPDATE
		`);

		if (!row) throw new Error(`User ${userId} not found`);

		const credits = parseCredits((row as { credits: unknown }).credits);
		const currentBalance = credits[creditType] ?? 0;
		const { maxBalance } = creditTypeConfig[creditType];
		let newBalance = currentBalance + amount;

		// Cap at maxBalance if configured
		if (maxBalance !== null && newBalance > maxBalance) {
			newBalance = maxBalance;
		}

		const actualAdded = newBalance - currentBalance;
		const updated: Credits = { ...credits, [creditType]: newBalance };

		await tx
			.update(user)
			.set({ credits: updated })
			.where(eq(user.id, userId));

		await tx.insert(creditTransaction).values({
			userId,
			creditType,
			amount: actualAdded,
			balanceAfter: newBalance,
			source,
			sourceId: sourceId ?? null,
			description: description ?? `Added ${amount} ${creditType}`
		});

		return newBalance;
	});
}

/**
 * Deduct credits from a user's balance. Throws InsufficientCreditsError if
 * the user doesn't have enough. Uses an atomic WHERE clause to prevent
 * concurrent checkouts from over-spending.
 */
export async function deductCredits(
	userId: string,
	creditType: CreditType,
	amount: number,
	source: string,
	sourceId?: string,
	description?: string
): Promise<number> {
	if (amount <= 0) throw new Error('Amount must be positive');
	assertCreditType(creditType);

	// Build the JSON key path as a validated literal — never from untrusted input
	const keyPath = `{${creditType}}`;

	return db.transaction(async (tx) => {
		// Atomic update: only succeeds if balance >= amount
		const result = await tx.execute(sql`
			UPDATE "user"
			SET credits = jsonb_set(
				credits,
				${sql.raw(`'${keyPath}'`)},
				to_jsonb((credits->>${sql.raw(`'${creditType}'`)})::int - ${amount})
			)
			WHERE id = ${userId}
			AND (credits->>${sql.raw(`'${creditType}'`)})::int >= ${amount}
			RETURNING (credits->>${sql.raw(`'${creditType}'`)})::int AS new_balance
		`);

		if (result.length === 0) {
			// Either user not found or insufficient balance — check which
			const credits = await getAllBalances(userId);
			const current = getBalanceFromCredits(credits, creditType);
			throw new InsufficientCreditsError(creditType, amount, current);
		}

		const newBalance = result[0].new_balance as number;

		await tx.insert(creditTransaction).values({
			userId,
			creditType,
			amount: -amount,
			balanceAfter: newBalance,
			source,
			sourceId: sourceId ?? null,
			description: description ?? `Deducted ${amount} ${creditType}`
		});

		return newBalance;
	});
}

/** Set balance to an exact value. Used for monthly resets (free hours). */
export async function setBalance(
	userId: string,
	creditType: CreditType,
	balance: number,
	source: string,
	sourceId?: string,
	description?: string
): Promise<number> {
	if (balance < 0) throw new Error('Balance cannot be negative');
	assertCreditType(creditType);

	return db.transaction(async (tx) => {
		const [row] = await tx.execute(sql`
			SELECT credits FROM "user" WHERE id = ${userId} FOR UPDATE
		`);

		if (!row) throw new Error(`User ${userId} not found`);

		const credits = parseCredits((row as { credits: unknown }).credits);
		const currentBalance = credits[creditType] ?? 0;
		const delta = balance - currentBalance;

		const updated: Credits = { ...credits, [creditType]: balance };

		await tx
			.update(user)
			.set({ credits: updated })
			.where(eq(user.id, userId));

		await tx.insert(creditTransaction).values({
			userId,
			creditType,
			amount: delta,
			balanceAfter: balance,
			source,
			sourceId: sourceId ?? null,
			description: description ?? `Set ${creditType} balance to ${balance}`
		});

		return balance;
	});
}

// ---------------------------------------------------------------------------
// Monthly allocation helpers
// ---------------------------------------------------------------------------

/**
 * Check if a transaction with the given source+sourceId already exists.
 * Used for idempotency on webhook-driven allocations.
 */
export async function hasTransaction(source: string, sourceId: string): Promise<boolean> {
	const [row] = await db
		.select({ id: creditTransaction.id })
		.from(creditTransaction)
		.where(and(
			eq(creditTransaction.source, source),
			eq(creditTransaction.sourceId, sourceId)
		))
		.limit(1);

	return !!row;
}

/** Set free_hours balance to the subscription-derived amount (no rollover). Idempotent by invoiceId. */
export async function allocateMonthlyCredits(
	userId: string,
	freeHours: number,
	sourceId: string
): Promise<number> {
	// Idempotency: skip if this invoice was already processed
	if (await hasTransaction('monthly_allocation', sourceId)) {
		const current = await getBalance(userId, 'free_hours');
		return current;
	}

	return setBalance(userId, 'free_hours', freeHours, 'monthly_allocation', sourceId);
}

/** Add equipment credits up to the cap. */
export async function allocateEquipmentCredits(
	userId: string,
	amount: number,
	sourceId?: string
): Promise<number> {
	return addCredits(userId, 'equipment_credits', amount, 'monthly_allocation', sourceId);
}
