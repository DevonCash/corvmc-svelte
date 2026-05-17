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
	getUserRoles: vi.fn().mockResolvedValue(['admin'])
}));

beforeEach(() => {
	queryResults = [];
	queryIndex = 0;
});

// ---------------------------------------------------------------------------
// Dashboard load
// ---------------------------------------------------------------------------
describe('/staff dashboard load', () => {
	it('returns stats and recent users', async () => {
		const recentUsers = [
			mockUser({ name: 'Alice' }),
			mockUser({ name: 'Bob' })
		];

		// The dashboard GET runs 5 parallel queries via Promise.all:
		// [totalUsers, totalRoles, totalPermissions, newUsersThisMonth, recentUsers]
		queryResults = [
			[{ value: 42 }],      // totalUsers count
			[{ value: 4 }],       // totalRoles count
			[{ value: 12 }],      // totalPermissions count
			[{ value: 3 }],       // newUsersThisMonth count
			recentUsers            // recent users
		];

		const { GET } = await import('../api/staff/dashboard/+server');
		const response = await GET({
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

		// The user list GET runs:
		// 1. total count
		// 2. paginated users
		// 3. role rows for those users
		queryResults = [
			[{ value: 2 }],
			users,
			[
				{ userId: 'u1', roleName: 'admin' },
				{ userId: 'u2', roleName: 'member' }
			]
		];

		const { GET } = await import('../api/staff/users/+server');
		const response = await GET({
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
			[{ value: 0 }],
			[],
			[]
		];

		const { GET } = await import('../api/staff/users/+server');
		const response = await GET({
			locals: { user: mockUser({ id: 'staff-1' }) },
			url: new URL('http://localhost/staff/users?q=alice')
		} as any);
		const result = await response.json() as any;

		expect(result.search).toBe('alice');
		expect(result.users).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// User detail load (tests data.remote.ts query functions)
// ---------------------------------------------------------------------------

vi.mock('$app/server', () => ({
	getRequestEvent: () => ({
		locals: { user: { id: 'staff-1' } },
		params: { id: 'user-1' },
		request: { headers: new Headers() }
	}),
	query: (...args: unknown[]) => {
		const handler = typeof args[0] === 'function' ? args[0] : args[1];
		const fn = handler as Function;
		(fn as any).__ = { type: 'query' };
		(fn as any).refresh = () => {};
		return fn;
	},
	form: (_schema: unknown, handler: Function) => {
		(handler as any).__ = { type: 'form' };
		(handler as any).for = () => handler;
		return handler;
	},
	command: (_schema: unknown, handler: Function) => {
		(handler as any).__ = { type: 'command' };
		return handler;
	}
}));

describe('/staff/users/[id] detail load', () => {
	it('returns user with roles and all available roles', async () => {
		const testUser = mockUser({ id: 'user-1', name: 'Alice' });

		// getUser does 1 select (user row), then getUserRoles
		queryResults = [
			[testUser]
		];

		const { getUser, getAllRoles } = await import('./users/[id]/data.remote');

		const result = await (getUser as Function)('user-1');
		expect(result.name).toBe('Alice');
		expect(result.roles).toEqual(['admin']); // from mocked getUserRoles

		// getAllRoles does 1 select (all role rows)
		const roles = mockStandardRoles();
		queryResults = [roles];
		queryIndex = 0;

		const allRoles = await (getAllRoles as Function)();
		expect(allRoles).toHaveLength(roles.length);
	});

	it('throws 404 when user not found', async () => {
		queryResults = [[]]; // no user row
		queryIndex = 0;

		const { getUser } = await import('./users/[id]/data.remote');

		await expect((getUser as Function)('nonexistent')).rejects.toThrow();
	});
});
