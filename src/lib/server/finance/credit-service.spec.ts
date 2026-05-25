import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the db module with proper operation-aware proxies
// ---------------------------------------------------------------------------

let selectResult: unknown[] = [];
let updateResult: unknown[] = [];
const insertedRows: unknown[] = [];

function buildSelectChain(result: () => unknown[]) {
	const proxy: any = new Proxy(() => proxy, {
		get(_, prop) {
			if (prop === 'then') {
				return (resolve: (v: unknown[]) => void) => resolve(result());
			}
			return () => proxy;
		}
	});
	return proxy;
}

function buildUpdateChain(result: () => unknown[]) {
	const proxy: any = new Proxy(() => proxy, {
		get(_, prop) {
			if (prop === 'then') {
				return (resolve: (v: unknown[]) => void) => resolve(result());
			}
			if (prop === 'returning') {
				return () => {
					const retProxy: any = new Proxy(() => retProxy, {
						get(_, p) {
							if (p === 'then') {
								return (res: (v: unknown[]) => void) => res(result());
							}
							return () => retProxy;
						}
					});
					return retProxy;
				};
			}
			return () => proxy;
		}
	});
	return proxy;
}

function buildInsertChain() {
	return {
		values: (row: unknown) => {
			insertedRows.push(row);
			return Promise.resolve();
		}
	};
}

const txMock = {
	select: () => buildSelectChain(() => selectResult),
	update: () => buildUpdateChain(() => updateResult),
	insert: () => buildInsertChain()
};

vi.mock('$lib/server/db', () => ({
	db: {
		select: () => buildSelectChain(() => selectResult),
		transaction: (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)
	}
}));

vi.mock('$lib/server/db/schema/authentication', () => ({
	user: {
		id: 'id',
		creditFreeHours: { name: 'credit_free_hours' },
		creditEquipment: { name: 'credit_equipment' }
	}
}));

vi.mock('$lib/server/db/schema/finance', () => ({
	creditTransaction: { id: 'id' },
	isCreditType: (v: string) => ['free_hours', 'equipment_credits'].includes(v),
	creditTypes: ['free_hours', 'equipment_credits'] as const
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn(),
	and: vi.fn(),
	gte: vi.fn(),
	sql: vi.fn()
}));

// Import after mocking
const {
	getBalance,
	getAllBalances,
	addCredits,
	deductCredits,
	setBalance,
	allocateMonthlyCredits,
	allocateEquipmentCredits,
	hasTransaction,
	InsufficientCreditsError
} = await import('./credit-service');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('getBalance', () => {
	beforeEach(() => {
		selectResult = [];
		insertedRows.length = 0;
	});

	it('returns 0 for user with no credits', async () => {
		selectResult = [{ free_hours: 0, equipment_credits: 0 }];
		const balance = await getBalance('user-1', 'free_hours');
		expect(balance).toBe(0);
	});

	it('returns 0 when user not found', async () => {
		selectResult = [];
		const balance = await getBalance('missing', 'free_hours');
		expect(balance).toBe(0);
	});

	it('returns the balance for a credit type that exists', async () => {
		selectResult = [{ free_hours: 5, equipment_credits: 0 }];
		const balance = await getBalance('user-1', 'free_hours');
		expect(balance).toBe(5);
	});
});

describe('getAllBalances', () => {
	beforeEach(() => {
		selectResult = [];
	});

	it('returns empty object for user not found', async () => {
		selectResult = [];
		const credits = await getAllBalances('missing');
		expect(credits).toEqual({});
	});

	it('returns parsed credits', async () => {
		selectResult = [{ free_hours: 3, equipment_credits: 10 }];
		const credits = await getAllBalances('user-1');
		expect(credits).toEqual({ free_hours: 3, equipment_credits: 10 });
	});
});

describe('addCredits', () => {
	beforeEach(() => {
		selectResult = [];
		insertedRows.length = 0;
	});

	it('increases balance and creates a transaction', async () => {
		selectResult = [{ balance: 2 }];

		const result = await addCredits('user-1', 'free_hours', 3, 'admin_adjustment', undefined, 'Test add');
		expect(result).toBe(5);
		expect(insertedRows).toHaveLength(1);
		expect(insertedRows[0]).toMatchObject({
			userId: 'user-1',
			creditType: 'free_hours',
			amount: 3,
			balanceAfter: 5,
			source: 'admin_adjustment',
			description: 'Test add'
		});
	});

	it('initializes balance when credit type does not exist yet', async () => {
		selectResult = [{ balance: 0 }];

		const result = await addCredits('user-1', 'free_hours', 4, 'monthly_allocation');
		expect(result).toBe(4);
		expect(insertedRows[0]).toMatchObject({
			amount: 4,
			balanceAfter: 4
		});
	});

	it('respects maxBalance cap from config', async () => {
		selectResult = [{ balance: 240 }];

		const result = await addCredits('user-1', 'equipment_credits', 20, 'monthly_allocation');
		expect(result).toBe(250);
		expect(insertedRows[0]).toMatchObject({
			amount: 10,
			balanceAfter: 250
		});
	});

	it('throws when amount is not positive', async () => {
		await expect(addCredits('user-1', 'free_hours', 0, 'admin_adjustment')).rejects.toThrow('Amount must be positive');
		await expect(addCredits('user-1', 'free_hours', -1, 'admin_adjustment')).rejects.toThrow('Amount must be positive');
	});

	it('throws when user not found', async () => {
		selectResult = [];
		await expect(addCredits('missing', 'free_hours', 1, 'admin_adjustment')).rejects.toThrow('User missing not found');
	});
});

describe('deductCredits', () => {
	beforeEach(() => {
		selectResult = [];
		updateResult = [];
		insertedRows.length = 0;
	});

	it('decreases balance and creates a transaction', async () => {
		updateResult = [{ newBalance: 3 }];

		const result = await deductCredits('user-1', 'free_hours', 2, 'checkout', 'sess-123');
		expect(result).toBe(3);
		expect(insertedRows[0]).toMatchObject({
			userId: 'user-1',
			creditType: 'free_hours',
			amount: -2,
			balanceAfter: 3,
			source: 'checkout',
			sourceId: 'sess-123'
		});
	});

	it('throws InsufficientCreditsError when balance is too low', async () => {
		updateResult = [];
		selectResult = [{ free_hours: 1, equipment_credits: 0 }];

		await expect(deductCredits('user-1', 'free_hours', 5, 'checkout'))
			.rejects.toBeInstanceOf(InsufficientCreditsError);
	});

	it('throws when amount is not positive', async () => {
		await expect(deductCredits('user-1', 'free_hours', 0, 'admin_adjustment')).rejects.toThrow('Amount must be positive');
	});
});

describe('setBalance', () => {
	beforeEach(() => {
		selectResult = [];
		insertedRows.length = 0;
	});

	it('resets to exact value and records the delta', async () => {
		selectResult = [{ balance: 8 }];

		const result = await setBalance('user-1', 'free_hours', 5, 'monthly_allocation', 'sub-123');
		expect(result).toBe(5);
		expect(insertedRows[0]).toMatchObject({
			amount: -3,
			balanceAfter: 5,
			source: 'monthly_allocation',
			sourceId: 'sub-123'
		});
	});

	it('sets balance from zero', async () => {
		selectResult = [{ balance: 0 }];

		const result = await setBalance('user-1', 'free_hours', 10, 'monthly_allocation');
		expect(result).toBe(10);
		expect(insertedRows[0]).toMatchObject({
			amount: 10,
			balanceAfter: 10
		});
	});

	it('throws for negative balance', async () => {
		await expect(setBalance('user-1', 'free_hours', -1, 'admin_adjustment')).rejects.toThrow('Balance cannot be negative');
	});

	it('throws when user not found', async () => {
		selectResult = [];
		await expect(setBalance('missing', 'free_hours', 5, 'admin_adjustment')).rejects.toThrow('User missing not found');
	});
});

describe('hasTransaction', () => {
	beforeEach(() => {
		selectResult = [];
	});

	it('returns true when a matching transaction exists', async () => {
		selectResult = [{ id: 1 }];
		expect(await hasTransaction('monthly_allocation', 'inv_123')).toBe(true);
	});

	it('returns false when no matching transaction exists', async () => {
		selectResult = [];
		expect(await hasTransaction('monthly_allocation', 'inv_999')).toBe(false);
	});
});

describe('allocateMonthlyCredits', () => {
	beforeEach(() => {
		selectResult = [];
		insertedRows.length = 0;
	});

	it('sets free_hours balance via setBalance', async () => {
		// hasTransaction uses db.select, setBalance uses tx.select
		// Both use selectResult — sequence: [] for hasTransaction, then { balance: 3 } for setBalance
		const results = [[] as unknown[], [{ balance: 3 }]];
		let callIdx = 0;
		const origSelectResult = selectResult;
		Object.defineProperty(globalThis, '__selectResult', { value: results, configurable: true });

		// Override to return sequential results
		selectResult = [];
		const origBuildSelect = buildSelectChain;
		const patchedTxSelect = () => buildSelectChain(() => {
			return [{ balance: 3 }];
		});
		txMock.select = patchedTxSelect;

		const result = await allocateMonthlyCredits('user-1', 5, 'inv_abc');
		expect(result).toBe(5);
		expect(insertedRows[0]).toMatchObject({
			creditType: 'free_hours',
			source: 'monthly_allocation',
			sourceId: 'inv_abc'
		});

		txMock.select = () => buildSelectChain(() => selectResult);
	});

	it('skips allocation when invoice was already processed', async () => {
		selectResult = [{ id: 99 }]; // hasTransaction returns true (found existing)

		const result = await allocateMonthlyCredits('user-1', 5, 'inv_dup');
		// Returns getBalance which also uses selectResult — will find the same row
		// But getBalance expects { free_hours, equipment_credits } format
		// Let's just verify no inserts happened
		expect(insertedRows).toHaveLength(0);
	});
});

describe('allocateEquipmentCredits', () => {
	beforeEach(() => {
		selectResult = [];
		insertedRows.length = 0;
	});

	it('adds equipment credits via addCredits', async () => {
		// addCredits uses tx.select to get current balance
		const origTxSelect = txMock.select;
		txMock.select = () => buildSelectChain(() => [{ balance: 100 }]);

		const result = await allocateEquipmentCredits('user-1', 50, 'sub-xyz');
		expect(result).toBe(150);
		expect(insertedRows[0]).toMatchObject({
			creditType: 'equipment_credits',
			source: 'monthly_allocation',
			sourceId: 'sub-xyz'
		});

		txMock.select = origTxSelect;
	});
});
