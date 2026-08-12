import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
// `countUnfilledByRole` is one grouped query, so what matters is the predicate it
// builds — a proxy that returns whatever it was queued can't tell a filtered
// query from an unfiltered one. Record the chained calls and render the SQL.
// ---------------------------------------------------------------------------

let selectResult: unknown[] = [];
let chainCalls: { method: string; args: unknown[] }[] = [];

function chainable() {
	const proxy: any = new Proxy(() => proxy, {
		get(_, prop) {
			if (prop === 'then') {
				return (resolve: (v: unknown[]) => void) => resolve(selectResult);
			}
			return (...args: unknown[]) => {
				chainCalls.push({ method: String(prop), args });
				return proxy;
			};
		}
	});
	return proxy;
}

vi.mock('$lib/server/db', () => ({
	db: {
		select: vi.fn(() => chainable()),
		insert: vi.fn(() => chainable()),
		update: vi.fn(() => chainable()),
		delete: vi.fn(() => chainable())
	}
}));

import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core';
import type { SQL } from 'drizzle-orm';
import { countUnfilledByRole } from './volunteer-shift-service';

/** The rendered WHERE clause of the query that ran. */
function renderedWhere() {
	const where = chainCalls.find((c) => c.method === 'where');
	expect(where, 'expected a where clause').toBeDefined();
	return new SQLiteSyncDialect().sqlToQuery(where!.args[0] as SQL);
}

beforeEach(() => {
	vi.clearAllMocks();
	selectResult = [];
	chainCalls = [];
});

describe('countUnfilledByRole', () => {
	it('keys the counts by role and coerces them to numbers', async () => {
		selectResult = [
			{ volunteerRoleId: 'role-1', unfilled: '3' },
			{ volunteerRoleId: 'role-2', unfilled: 1 }
		];

		const counts = await countUnfilledByRole();

		expect(counts.get('role-1')).toBe(3);
		expect(counts.get('role-2')).toBe(1);
	});

	// Only short roles come back, so the column reads with `?? 0`. A role with
	// every shift filled is absent rather than present at zero.
	it('omits a role with nothing short', async () => {
		selectResult = [{ volunteerRoleId: 'role-1', unfilled: 2 }];

		const counts = await countUnfilledByRole();

		expect(counts.has('role-2')).toBe(false);
		expect(counts.get('role-2') ?? 0).toBe(0);
	});

	// Neither a cancelled shift nor one already past is something anyone can still
	// fill; counting them would leave every role permanently flagged.
	it('excludes cancelled and past shifts', async () => {
		await countUnfilledByRole(new Date('2026-06-01T00:00:00Z'));

		const { sql } = renderedWhere();
		expect(sql).toContain('cancelled_at');
		expect(sql).toContain('is null');
		expect(sql).toContain('starts_at');
	});

	it('counts a shift only while its claims fall short of capacity', async () => {
		await countUnfilledByRole();

		const { sql } = renderedWhere();
		expect(sql).toContain('capacity');
		expect(sql).toContain('volunteer_signup');
	});

	// The statuses that hold a place come from ACTIVE_SIGNUP_STATUSES rather than
	// being spelled into the fragment, so they arrive as bound parameters.
	it('binds the statuses that hold a place', async () => {
		await countUnfilledByRole();

		const { params } = renderedWhere();
		expect(params).toContain('claimed');
		expect(params).toContain('confirmed');
		expect(params).toContain('completed');
	});

	// A Date reaching the driver as an object is rejected outright —
	// `D1_TYPE_ERROR: Type 'object' not supported` — which would 500 the whole
	// roles page. The boundary has to bind as the unix seconds the column stores.
	it('binds the date boundary as a number, not a Date', async () => {
		await countUnfilledByRole(new Date('2026-06-01T00:00:00Z'));

		const { params } = renderedWhere();
		expect(params.map((p) => typeof p)).not.toContain('object');
	});
});
