import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockUser, mockRole, mockStandardRoles } from '$lib/server/db/test-factory';

// ---------------------------------------------------------------------------
// Mock db — all queries resolve to controlled data
// ---------------------------------------------------------------------------
let queryResults: unknown[][] = []; // stack of results, shifted per query
let queryIndex = 0;

function chainable() {
	const proxy: any = new Proxy(() => proxy, {
		get(_, prop) {
			if (prop === 'then') {
				const results = queryResults[queryIndex] ?? [];
				queryIndex++;
				return (resolve: (v: unknown[]) => void) => resolve(results);
			}
			return () => proxy;
		}
	});
	return proxy;
}

vi.mock('$lib/server/db', () => ({
	db: {
		select: () => chainable(),
		insert: () => chainable(),
		update: () => chainable(),
		delete: () => chainable()
	}
}));

// Mock authorization helper
vi.mock('$lib/server/authorization', () => ({
	hasRole: vi.fn().mockResolvedValue(true),
	hasAnyRole: vi.fn().mockResolvedValue(true),
	getUserRoles: vi.fn().mockResolvedValue(['admin']),
	requireStaff: vi.fn().mockResolvedValue(undefined)
}));

// Mock finance services
const mockListByUser = vi.fn().mockResolvedValue([]);
const mockGetAllBalances = vi.fn().mockResolvedValue([]);
const mockAddCredits = vi.fn().mockResolvedValue(undefined);
const mockDeductCredits = vi.fn().mockResolvedValue(undefined);

vi.mock('$lib/server/finance/payment-cache-service', () => ({
	listByUser: (...args: unknown[]) => mockListByUser(...args)
}));

vi.mock('$lib/server/finance/credit-service', () => ({
	getAllBalances: (...args: unknown[]) => mockGetAllBalances(...args),
	addCredits: (...args: unknown[]) => mockAddCredits(...args),
	deductCredits: (...args: unknown[]) => mockDeductCredits(...args)
}));

beforeEach(() => {
	queryResults = [];
	queryIndex = 0;
	mockListByUser.mockClear();
	mockGetAllBalances.mockClear();
	mockAddCredits.mockClear();
	mockDeductCredits.mockClear();
});

// ---------------------------------------------------------------------------
// Dashboard load
// ---------------------------------------------------------------------------
const { GET: dashboardGET } = await import('../api/staff/dashboard/+server');
const { GET: usersGET } = await import('../api/staff/users/+server');

describe('/staff dashboard load', () => {
	it('returns stats and recent users', async () => {
		const recentUsers = [
			mockUser({ name: 'Alice' }),
			mockUser({ name: 'Bob' })
		];

		queryResults = [
			[{ value: 42 }],
			[{ value: 4 }],
			[{ value: 12 }],
			[{ value: 3 }],
			recentUsers
		];

		const response = await dashboardGET({
			locals: { user: mockUser({ id: 'staff-1' }) },
			url: new URL('http://localhost')
		} as any);
		const result = await response.json() as any;

		expect(result.stats.totalUsers).toBe(42);
		expect(result.stats.totalRoles).toBe(4);
		expect(result.stats.totalPermissions).toBe(12);
		expect(result.stats.newUsersThisMonth).toBe(3);
		expect(result.recentUsers).toHaveLength(2);
		expect(result.recentUsers[0].name).toBe('Alice');
	});
});

// ---------------------------------------------------------------------------
// User list load
// ---------------------------------------------------------------------------
describe('/staff/users list load', () => {
	it('returns paginated users with roles', async () => {
		const users = [
			mockUser({ id: 'u1', name: 'Alice' }),
			mockUser({ id: 'u2', name: 'Bob' })
		];

		queryResults = [
			users,
			[{ count: 2 }],
			[
				{ userId: 'u1', roleName: 'admin' },
				{ userId: 'u2', roleName: 'member' }
			]
		];

		const response = await usersGET({
			locals: { user: mockUser({ id: 'staff-1' }) },
			url: new URL('http://localhost/staff/users')
		} as any);
		const result = await response.json() as any;

		expect(result.users).toHaveLength(2);
		expect(result.users[0].roles).toEqual(['admin']);
		expect(result.users[1].roles).toEqual(['member']);
		expect(result.pagination.total).toBe(2);
		expect(result.pagination.page).toBe(1);
	});

	it('passes search query through', async () => {
		queryResults = [
			[],
			[{ count: 0 }],
			[]
		];

		const response = await usersGET({
			locals: { user: mockUser({ id: 'staff-1' }) },
			url: new URL('http://localhost/staff/users?q=alice')
		} as any);
		const result = await response.json() as any;

		expect(result.search).toBe('alice');
		expect(result.users).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// User detail load (tests $lib/remote/users query functions)
// ---------------------------------------------------------------------------

let _insideHandler = false;

vi.mock('$app/server', () => ({
	getRequestEvent: () => ({
		locals: { user: { id: 'staff-1' } },
		params: { id: 'user-1' },
		request: { headers: new Headers() }
	}),
	query: (...args: unknown[]) => {
		const handler = typeof args[0] === 'function' ? args[0] : args[1];
		const wrapped = (...callArgs: unknown[]) => {
			// When called from inside another handler (fire-and-forget refresh pattern),
			// return a resolved promise to avoid unhandled rejections
			if (_insideHandler) {
				const p = Promise.resolve(undefined);
				(p as any).refresh = () => Promise.resolve();
				return p;
			}
			const result = (handler as Function)(...callArgs);
			if (result && typeof result.then === 'function') {
				const p = result.then((v: unknown) => v);
				(p as any).refresh = () => Promise.resolve();
				return p;
			}
			(result as any).refresh = () => Promise.resolve();
			return result;
		};
		(wrapped as any).__ = { type: 'query' };
		(wrapped as any).refresh = () => Promise.resolve();
		return wrapped;
	},
	form: (_schema: unknown, handler: Function) => {
		const wrapped = async (...args: unknown[]) => {
			_insideHandler = true;
			try {
				return await (handler as Function)(...args);
			} finally {
				_insideHandler = false;
			}
		};
		(wrapped as any).__ = { type: 'form' };
		(wrapped as any).for = () => wrapped;
		return wrapped;
	},
	command: (_schema: unknown, handler: Function) => {
		const wrapped = async (...args: unknown[]) => {
			_insideHandler = true;
			try {
				return await (handler as Function)(...args);
			} finally {
				_insideHandler = false;
			}
		};
		(wrapped as any).__ = { type: 'command' };
		return wrapped;
	}
}));

const { getUser, getAllRoles, getUserPayments, getUserCredits, updateUser } = await import('$lib/remote/users.remote');

describe('/staff/users/[id] detail load', () => {
	it('returns user with roles and all available roles', async () => {
		const testUser = mockUser({ id: 'user-1', name: 'Alice' });

		queryResults = [
			[testUser]
		];

		const result = await (getUser as Function)('user-1');
		expect(result.name).toBe('Alice');
		expect(result.roles).toEqual(['admin']);

		const roles = mockStandardRoles();
		queryResults = [roles];
		queryIndex = 0;

		const allRoles = await (getAllRoles as Function)();
		expect(allRoles).toHaveLength(roles.length);
	});

	it('throws 404 when user not found', async () => {
		queryResults = [[]];
		queryIndex = 0;

		await expect((getUser as Function)('nonexistent')).rejects.toThrow();
	});
});

// ---------------------------------------------------------------------------
// User payments query
// ---------------------------------------------------------------------------
describe('/staff/users/[id] getUserPayments', () => {
	it('delegates to payment cache service', async () => {
		const payments = [{ id: 'pay-1', amount: 5000 }];
		mockListByUser.mockResolvedValueOnce(payments);

		const result = await (getUserPayments as Function)('user-1');
		expect(result).toEqual(payments);
		expect(mockListByUser).toHaveBeenCalledWith('user-1');
	});

	it('returns empty array when user has no payments', async () => {
		mockListByUser.mockResolvedValueOnce([]);

		const result = await (getUserPayments as Function)('user-1');
		expect(result).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// User credits query
// ---------------------------------------------------------------------------
describe('/staff/users/[id] getUserCredits', () => {
	it('delegates to credit service getAllBalances', async () => {
		const balances = [
			{ type: 'free_hours', balance: 3 },
			{ type: 'equipment_credits', balance: 5 }
		];
		mockGetAllBalances.mockResolvedValueOnce(balances);

		const result = await (getUserCredits as Function)('user-1');
		expect(result).toEqual(balances);
		expect(mockGetAllBalances).toHaveBeenCalledWith('user-1');
	});

	it('returns empty array when user has no credits', async () => {
		mockGetAllBalances.mockResolvedValueOnce([]);

		const result = await (getUserCredits as Function)('user-1');
		expect(result).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// Update user form
// ---------------------------------------------------------------------------
describe('/staff/users/[id] updateUser', () => {
	it('updates user fields and syncs roles', async () => {
		const { db } = await import('$lib/server/db');
		const originalTransaction = (db as any).transaction;
		(db as any).transaction = async (cb: Function) => cb({
			update: () => chainable(),
			delete: () => chainable(),
			insert: () => chainable()
		});

		// Provide result for the internal getUser(id) refresh call
		queryResults = [[mockUser({ id: 'user-1', name: 'Updated Name' })]];
		queryIndex = 0;

		const result = await (updateUser as unknown as Function)({
			name: 'Updated Name',
			pronouns: 'they/them',
			phone: '555-1234',
			roles: ['1', '2']
		});

		expect(result).toEqual({ success: true });

		(db as any).transaction = originalTransaction;
	});

	it('handles empty roles array', async () => {
		const { db } = await import('$lib/server/db');
		const originalTransaction = (db as any).transaction;
		const insertSpy = vi.fn(() => chainable());
		(db as any).transaction = async (cb: Function) => cb({
			update: () => chainable(),
			delete: () => chainable(),
			insert: insertSpy
		});

		// Provide result for the internal getUser(id) refresh call
		queryResults = [[mockUser({ id: 'user-1', name: 'No Roles User' })]];
		queryIndex = 0;

		const result = await (updateUser as unknown as Function)({
			name: 'No Roles User',
			pronouns: '',
			phone: '',
			roles: []
		});

		expect(result).toEqual({ success: true });
		expect(insertSpy).not.toHaveBeenCalled();

		(db as any).transaction = originalTransaction;
	});
});

