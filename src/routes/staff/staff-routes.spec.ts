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

		// The dashboard load runs 5 parallel queries via Promise.all:
		// [totalUsers, totalRoles, totalPermissions, newUsersThisMonth, recentUsers]
		queryResults = [
			[{ value: 42 }],      // totalUsers count
			[{ value: 4 }],       // totalRoles count
			[{ value: 12 }],      // totalPermissions count
			[{ value: 3 }],       // newUsersThisMonth count
			recentUsers            // recent users
		];

		const { load } = await import('./+page.server');
		const result = (await load({} as any)) as any;

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

		// The user list load runs:
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

		const { load } = await import('./users/+page.server');
		const result = (await load({
			url: new URL('http://localhost/staff/users')
		} as any)) as any;

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

		const { load } = await import('./users/+page.server');
		const result = (await load({
			url: new URL('http://localhost/staff/users?q=alice')
		} as any)) as any;

		expect(result.search).toBe('alice');
		expect(result.users).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// User detail load
// TODO: Rewrite tests for remote functions (getUser, getAllRoles from data.remote.ts)
// ---------------------------------------------------------------------------
describe.skip('/staff/users/[id] detail load', () => {
	it('returns user with roles and all available roles', () => {
		// Previously tested +page.server.ts load function.
		// Now uses remote query — needs new test approach.
	});

	it('throws 404 when user not found', () => {
		// Previously tested +page.server.ts load function.
	});
});
