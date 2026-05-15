import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/auth';
import { creditTransaction } from '$lib/server/db/schema/finance';
import { eq, and, sql, gte } from 'drizzle-orm';
import {
	isCreditType,
	creditTypeConfig,
	type CreditType,
	type Credits
} from './types';

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

	const col = creditColumn[creditType];

	return db.transaction(async (tx) => {
		const [row] = await tx
			.select({ balance: col })
			.from(user)
			.where(eq(user.id, userId));

		if (!row) throw new Error(`User ${userId} not found`);

		const currentBalance = row.balance;
		const { maxBalance } = creditTypeConfig[creditType];
		let newBalance = currentBalance + amount;

		if (maxBalance !== null && newBalance > maxBalance) {
			newBalance = maxBalance;
		}

		const actualAdded = newBalance - currentBalance;

		await tx
			.update(user)
			.set({ [creditColumn[creditType].name]: newBalance })
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

	const col = creditColumn[creditType];

	return db.transaction(async (tx) => {
		const result = await tx
			.update(user)
			.set({
				[col.name]: sql`${col} - ${amount}`
			})
			.where(and(eq(user.id, userId), gte(col, amount)))
			.returning({ newBalance: col });

		if (result.length === 0) {
			const credits = await getAllBalances(userId);
			const current = credits[creditType] ?? 0;
			throw new InsufficientCreditsError(creditType, amount, current);
		}

		const newBalance = result[0].newBalance;

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

	const col = creditColumn[creditType];

	return db.transaction(async (tx) => {
		const [row] = await tx
			.select({ balance: col })
			.from(user)
			.where(eq(user.id, userId));

		if (!row) throw new Error(`User ${userId} not found`);

		const currentBalance = row.balance;
		const delta = balance - currentBalance;

		await tx
			.update(user)
			.set({ [col.name]: balance })
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
