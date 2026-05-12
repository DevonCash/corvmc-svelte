import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockUser, mockRole, mockStandardRoles } from '$lib/server/db/test-factory';

// ---------------------------------------------------------------------------
// Mock the db module with a chainable query builder
// ---------------------------------------------------------------------------
let queryResults: unknown[] = [];

function chainable() {
	const proxy: any = new Proxy(() => proxy, {
		get(_, prop) {
			if (prop === 'then') {
				// Make the chain awaitable — resolve with current queryResults
				return (resolve: (v: unknown[]) => void) => resolve(queryResults);
			}
			// Any method call returns the proxy so chaining works
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

// Import after mocking
const { hasRole, hasAnyRole, getUserRoles } = await import('./authorization');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('hasRole', () => {
	beforeEach(() => {
		queryResults = [];
	});

	it('returns true when the user has the role', async () => {
		queryResults = [{ roleId: 1 }];

		const result = await hasRole('user-123', 'admin');
		expect(result).toBe(true);
	});

	it('returns false when the user does not have the role', async () => {
		queryResults = [];

		const result = await hasRole('user-123', 'admin');
		expect(result).toBe(false);
	});
});

describe('hasAnyRole', () => {
	beforeEach(() => {
		queryResults = [];
	});

	it('returns true if user has at least one of the roles', async () => {
		// hasAnyRole checks sequentially — first call returns empty, second returns a match
		let callCount = 0;
		const originalResults = queryResults;

		// Override the then behavior to alternate results
		// Since hasAnyRole calls hasRole in a loop, we need per-call results
		// The simplest approach: just set results to match on first call
		queryResults = [{ roleId: 1 }];

		const result = await hasAnyRole('user-123', ['admin', 'staff']);
		expect(result).toBe(true);
	});

	it('returns false if user has none of the roles', async () => {
		queryResults = [];

		const result = await hasAnyRole('user-123', ['admin', 'staff']);
		expect(result).toBe(false);
	});
});

describe('getUserRoles', () => {
	it('returns role names for the user', async () => {
		queryResults = [{ name: 'admin' }, { name: 'staff' }];

		const roles = await getUserRoles('user-123');
		expect(roles).toEqual(['admin', 'staff']);
	});

	it('returns empty array when user has no roles', async () => {
		queryResults = [];

		const roles = await getUserRoles('user-123');
		expect(roles).toEqual([]);
	});
});
