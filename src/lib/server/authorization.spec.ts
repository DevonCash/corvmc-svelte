import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core';
import type { SQL } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Mock the db module with a chainable query builder
// ---------------------------------------------------------------------------
let queryResults: unknown[] = [];
/** Predicates passed to `.where()`, so they can be rendered to real SQL below. */
const whereClauses: unknown[] = [];

function chainable() {
	const proxy: any = new Proxy(() => proxy, {
		get(_, prop) {
			if (prop === 'then') {
				// Make the chain awaitable — resolve with current queryResults
				return (resolve: (v: unknown[]) => void) => resolve(queryResults);
			}
			if (prop === 'where') {
				return (clause: unknown) => {
					whereClauses.push(clause);
					return proxy;
				};
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
const { hasRole, hasAnyRole, getUserRoles, findStaffUserByEmail } = await import('./authorization');

// drizzle and the schema are real, so the predicate the service builds can be
// rendered to actual SQL and asserted on rather than taken on faith.
const dialect = new SQLiteSyncDialect();
const renderWhere = (index: number) => dialect.sqlToQuery(whereClauses[index] as SQL).sql;

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

describe('findStaffUserByEmail', () => {
	beforeEach(() => {
		queryResults = [];
		whereClauses.length = 0;
	});

	it('returns the staff user behind an address', async () => {
		queryResults = [{ id: 'staff-1', name: 'Ada', email: 'ada@corvmc.org' }];

		await expect(findStaffUserByEmail('ada@corvmc.org')).resolves.toEqual({
			id: 'staff-1',
			name: 'Ada',
			email: 'ada@corvmc.org'
		});
	});

	it('returns null when the address belongs to nobody with a staff role', async () => {
		queryResults = [];

		await expect(findStaffUserByEmail('stranger@example.com')).resolves.toBeNull();
	});

	it('matches case-insensitively, since no mail client normalises From', async () => {
		// SQLite compares TEXT with `=` case-sensitively, so the lower() is what
		// stops `Ada@corvmc.org` on an envelope being treated as a stranger.
		await findStaffUserByEmail('  Ada@CorvMC.org ');

		expect(renderWhere(0)).toContain('lower(');
	});

	it('only ever matches admin and staff roles', async () => {
		await findStaffUserByEmail('ada@corvmc.org');

		expect(renderWhere(0)).toContain('"roles"."name" in (?, ?)');
	});

	it('skips the query entirely for a blank address', async () => {
		await expect(findStaffUserByEmail('   ')).resolves.toBeNull();

		expect(whereClauses).toHaveLength(0);
	});
});
