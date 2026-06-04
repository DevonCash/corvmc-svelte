import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/authentication';
import { creditTransaction } from '$lib/server/db/schema/finance';
import { eq, and, sql, gte, lte, desc, like, or, count, type SQL } from 'drizzle-orm';
import { paginate, type PaginationInput, type PaginatedResult } from '$lib/server/db/paginate';
import { buildDateInTz } from '$lib/server/reservation/timezone';
import { creditTypeConfig, DEFAULT_TIMEZONE } from '$lib/config';
import {
	isCreditType,
	type CreditType,
	type Credits,
	type TransactionSource
} from '$lib/server/db/schema/finance';

// ---------------------------------------------------------------------------
// Column mapping — maps credit type names to user table columns
// ---------------------------------------------------------------------------

const creditColumn = {
	free_hours: user.creditFreeHours,
	equipment_credits: user.creditEquipment
} as const satisfies Record<CreditType, unknown>;

export class InsufficientCreditsError extends Error {
	constructor(type: CreditType, requested: number, available: number) {
		super(`Insufficient ${type}: requested ${requested}, available ${available}`);
		this.name = 'InsufficientCreditsError';
	}
}

function assertCreditType(type: string): asserts type is CreditType {
	if (!isCreditType(type)) {
		throw new Error(`Invalid credit type: ${type}`);
	}
}

export async function getBalance(userId: string, creditType: CreditType): Promise<number> {
	const credits = await getAllBalances(userId);
	return credits[creditType] ?? 0;
}

export async function getAllBalances(userId: string): Promise<Credits> {
	const [row] = await db
		.select({
			free_hours: user.creditFreeHours,
			equipment_credits: user.creditEquipment
		})
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);

	if (!row) return {};
	return {
		free_hours: row.free_hours,
		equipment_credits: row.equipment_credits
	};
}

// ---------------------------------------------------------------------------
// Balance mutations
//
// Cloudflare D1 has no interactive transactions, so read-modify-write flows use
// optimistic concurrency: read the balance, compute the next value, then write
// it with a compare-and-swap UPDATE that only matches if the balance hasn't
// changed since the read. A concurrent writer makes the CAS match zero rows, so
// we re-read and retry. The single relative-decrement path in deductCredits is
// already race-free and needs no retry.
// ---------------------------------------------------------------------------

const MAX_BALANCE_RETRIES = 5;

/**
 * Compare-and-swap a user's credit balance and append a matching ledger entry.
 * `computeNext` derives the new balance from the freshly-read current balance.
 * Retries on contention; throws if the user is missing or contention persists.
 */
async function applyBalanceMutation(
	userId: string,
	creditType: CreditType,
	computeNext: (current: number) => number,
	ledger: { source: TransactionSource; sourceId?: string; description: string }
): Promise<number> {
	const col = creditColumn[creditType];

	for (let attempt = 0; attempt <= MAX_BALANCE_RETRIES; attempt++) {
		const [row] = await db.select({ balance: col }).from(user).where(eq(user.id, userId)).limit(1);

		if (!row) throw new Error(`User ${userId} not found`);

		const current = row.balance;
		const next = computeNext(current);

		// CAS: only write if the balance is still what we read.
		const updated = await db
			.update(user)
			.set({ [col.name]: next })
			.where(and(eq(user.id, userId), eq(col, current)))
			.returning({ balance: col });

		if (updated.length === 0) continue; // balance changed concurrently — retry

		await db.insert(creditTransaction).values({
			userId,
			creditType,
			amount: next - current,
			balanceAfter: next,
			source: ledger.source,
			sourceId: ledger.sourceId ?? null,
			description: ledger.description
		});

		return next;
	}

	throw new Error(
		`Credit update for ${userId} failed after ${MAX_BALANCE_RETRIES} retries due to contention`
	);
}

export async function addCredits(
	userId: string,
	creditType: CreditType,
	amount: number,
	source: TransactionSource,
	sourceId?: string,
	description?: string
): Promise<number> {
	if (amount <= 0) throw new Error('Amount must be positive');
	assertCreditType(creditType);

	const { maxBalance } = creditTypeConfig[creditType];

	return applyBalanceMutation(
		userId,
		creditType,
		(current) => (maxBalance !== null ? Math.min(current + amount, maxBalance) : current + amount),
		{ source, sourceId, description: description ?? `Added ${amount} ${creditType}` }
	);
}

export async function deductCredits(
	userId: string,
	creditType: CreditType,
	amount: number,
	source: TransactionSource,
	sourceId?: string,
	description?: string
): Promise<number> {
	if (amount <= 0) throw new Error('Amount must be positive');
	assertCreditType(creditType);

	const col = creditColumn[creditType];

	// Race-free relative decrement: the WHERE guard rejects the write atomically
	// if the balance is too low, so no read-modify-write window exists.
	const result = await db
		.update(user)
		.set({ [col.name]: sql`${col} - ${amount}` })
		.where(and(eq(user.id, userId), gte(col, amount)))
		.returning({ newBalance: col });

	if (result.length === 0) {
		const credits = await getAllBalances(userId);
		const current = credits[creditType] ?? 0;
		throw new InsufficientCreditsError(creditType, amount, current);
	}

	const newBalance = result[0].newBalance;

	await db.insert(creditTransaction).values({
		userId,
		creditType,
		amount: -amount,
		balanceAfter: newBalance,
		source,
		sourceId: sourceId ?? null,
		description: description ?? `Deducted ${amount} ${creditType}`
	});

	return newBalance;
}

export async function setBalance(
	userId: string,
	creditType: CreditType,
	balance: number,
	source: TransactionSource,
	sourceId?: string,
	description?: string
): Promise<number> {
	if (balance < 0) throw new Error('Balance cannot be negative');
	assertCreditType(creditType);

	return applyBalanceMutation(userId, creditType, () => balance, {
		source,
		sourceId,
		description: description ?? `Set ${creditType} balance to ${balance}`
	});
}

// ---------------------------------------------------------------------------
// Monthly allocation helpers
// ---------------------------------------------------------------------------

export async function hasTransaction(
	source: TransactionSource,
	sourceId: string
): Promise<boolean> {
	const [row] = await db
		.select({ id: creditTransaction.id })
		.from(creditTransaction)
		.where(and(eq(creditTransaction.source, source), eq(creditTransaction.sourceId, sourceId)))
		.limit(1);

	return !!row;
}

export async function allocateMonthlyCredits(
	userId: string,
	freeHours: number,
	sourceId: string
): Promise<number> {
	if (await hasTransaction('monthly_allocation', sourceId)) {
		const current = await getBalance(userId, 'free_hours');
		return current;
	}

	return setBalance(userId, 'free_hours', freeHours, 'monthly_allocation', sourceId);
}

export async function allocateEquipmentCredits(
	userId: string,
	amount: number,
	sourceId?: string
): Promise<number> {
	return addCredits(userId, 'equipment_credits', amount, 'monthly_allocation', sourceId);
}

// ---------------------------------------------------------------------------
// Transaction listing
// ---------------------------------------------------------------------------

const TZ = DEFAULT_TIMEZONE;

export interface CreditTransactionRow {
	id: number;
	userId: string;
	userName: string | null;
	userEmail: string;
	creditType: string;
	amount: number;
	balanceAfter: number;
	source: string;
	sourceId: string | null;
	description: string;
	createdAt: string;
}

export interface CreditTransactionFilters {
	search?: string;
	creditType?: CreditType;
	source?: TransactionSource;
	from?: string;
	to?: string;
}

function escapeLike(input: string): string {
	return input.replace(/[%_\\]/g, (ch) => `\\${ch}`);
}

function buildTransactionFilters(filters: CreditTransactionFilters): SQL[] {
	const conditions: SQL[] = [];

	if (filters.search) {
		const escaped = escapeLike(filters.search);
		conditions.push(or(like(user.name, `%${escaped}%`), like(user.email, `%${escaped}%`))!);
	}

	if (filters.creditType) {
		conditions.push(eq(creditTransaction.creditType, filters.creditType));
	}

	if (filters.source) {
		conditions.push(eq(creditTransaction.source, filters.source));
	}

	if (filters.from) {
		conditions.push(gte(creditTransaction.createdAt, buildDateInTz(filters.from, '00:00', TZ)));
	}

	if (filters.to) {
		conditions.push(lte(creditTransaction.createdAt, buildDateInTz(filters.to, '23:59', TZ)));
	}

	return conditions;
}

const transactionSelect = {
	id: creditTransaction.id,
	userId: creditTransaction.userId,
	userName: user.name,
	userEmail: user.email,
	creditType: creditTransaction.creditType,
	amount: creditTransaction.amount,
	balanceAfter: creditTransaction.balanceAfter,
	source: creditTransaction.source,
	sourceId: creditTransaction.sourceId,
	description: creditTransaction.description,
	createdAt: creditTransaction.createdAt
};

export async function listTransactions(
	filters: CreditTransactionFilters = {},
	pagination: PaginationInput = {}
): Promise<PaginatedResult<CreditTransactionRow>> {
	const conditions = buildTransactionFilters(filters);
	const where = conditions.length > 0 ? and(...conditions) : undefined;

	const dataQ = db
		.select(transactionSelect)
		.from(creditTransaction)
		.innerJoin(user, eq(user.id, creditTransaction.userId))
		.where(where)
		.orderBy(desc(creditTransaction.createdAt))
		.$dynamic();

	const countQ = db
		.select({ count: count() })
		.from(creditTransaction)
		.innerJoin(user, eq(user.id, creditTransaction.userId))
		.where(where);

	const result = await paginate(dataQ, countQ, pagination);
	return {
		...result,
		rows: result.rows.map((row) => ({
			...row,
			createdAt: row.createdAt.toISOString()
		}))
	};
}
