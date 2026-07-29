import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, insertUser, type TestDb } from '$lib/server/db/test-db';
import { creditTransaction } from '$lib/server/db/schema/finance';
import { eq } from 'drizzle-orm';
import {
	getBalance,
	addCredits,
	deductCredits,
	allocateMonthlyCredits,
	allocateEquipmentCredits,
	InsufficientCreditsError
} from './credit-service';

// Real in-memory SQLite: the compare-and-swap / atomic-guard SQL runs for real,
// so these tests catch balance and double-spend regressions the stubbed specs
// cannot. `equipment_credits` has a maxBalance of 25000; `free_hours` is uncapped.

let ctx: TestDb;
let userId: string;

beforeEach(async () => {
	ctx = createTestDb();
	const u = await insertUser(ctx.db, { creditFreeHours: 5, creditEquipment: 0 });
	userId = u.id;
});

afterEach(() => ctx.close());

async function ledgerFor(type: string) {
	return ctx.db
		.select()
		.from(creditTransaction)
		.where(eq(creditTransaction.creditType, type as 'free_hours' | 'equipment_credits'));
}

describe('deductCredits (atomic guard)', () => {
	it('deducts when the balance is sufficient and appends a matching ledger row', async () => {
		const newBalance = await deductCredits(userId, 'free_hours', 3, 'reservation');

		expect(newBalance).toBe(2);
		expect(await getBalance(userId, 'free_hours')).toBe(2);

		const ledger = await ledgerFor('free_hours');
		expect(ledger).toHaveLength(1);
		expect(ledger[0]).toMatchObject({ amount: -3, balanceAfter: 2, source: 'reservation' });
	});

	it('rejects an over-deduction without going negative and without a ledger row', async () => {
		await expect(deductCredits(userId, 'free_hours', 8, 'reservation')).rejects.toBeInstanceOf(
			InsufficientCreditsError
		);

		// Balance untouched, no ledger entry written.
		expect(await getBalance(userId, 'free_hours')).toBe(5);
		expect(await ledgerFor('free_hours')).toHaveLength(0);
	});

	it('never lets sequential deductions overspend the balance', async () => {
		expect(await deductCredits(userId, 'free_hours', 3, 'reservation')).toBe(2);
		// Second deduction of 3 would overspend — the WHERE guard rejects it atomically.
		await expect(deductCredits(userId, 'free_hours', 3, 'reservation')).rejects.toBeInstanceOf(
			InsufficientCreditsError
		);
		expect(await getBalance(userId, 'free_hours')).toBe(2);
	});
});

describe('addCredits (compare-and-swap + clamp)', () => {
	it('adds equipment credits and records the ledger', async () => {
		const balance = await addCredits(userId, 'equipment_credits', 1000, 'admin_adjustment');

		expect(balance).toBe(1000);
		expect(await getBalance(userId, 'equipment_credits')).toBe(1000);
	});

	it('clamps equipment credits at the configured maxBalance (25000)', async () => {
		await addCredits(userId, 'equipment_credits', 20000, 'admin_adjustment');
		const balance = await addCredits(userId, 'equipment_credits', 10000, 'admin_adjustment');

		expect(balance).toBe(25000);
		expect(await getBalance(userId, 'equipment_credits')).toBe(25000);
	});
});

describe('allocation idempotency (double-grant guard)', () => {
	it('allocateMonthlyCredits sets free hours once per invoice and is a no-op on redelivery', async () => {
		expect(await allocateMonthlyCredits(userId, 4, 'invoice-abc')).toBe(4);
		// Redelivered invoice with the same sourceId must not re-grant.
		expect(await allocateMonthlyCredits(userId, 4, 'invoice-abc')).toBe(4);

		// One allocation ledger row, not two.
		const ledger = (await ledgerFor('free_hours')).filter((r) => r.sourceId === 'invoice-abc');
		expect(ledger).toHaveLength(1);
	});

	it('allocateEquipmentCredits adds once per invoice and is a no-op on redelivery', async () => {
		expect(await allocateEquipmentCredits(userId, 500, 'invoice-xyz')).toBe(500);
		expect(await allocateEquipmentCredits(userId, 500, 'invoice-xyz')).toBe(500);

		expect(await getBalance(userId, 'equipment_credits')).toBe(500);
	});
});
