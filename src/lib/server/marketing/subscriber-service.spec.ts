import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('$lib/server/db', () => {
	const db = { update: vi.fn() };
	return { db };
});

vi.mock('$lib/server/db/schema/marketing', () => ({
	subscriber: {
		id: 'subscriber.id',
		email: 'subscriber.email',
		suppressedAt: 'subscriber.suppressedAt',
		suppressionReason: 'subscriber.suppressionReason'
	}
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn((col: unknown, val: unknown) => ({ col, val, op: 'eq' })),
	and: vi.fn((...args: unknown[]) => ({ args, op: 'and' })),
	isNull: vi.fn((col: unknown) => ({ col, op: 'isNull' })),
	sql: vi.fn(() => ({ op: 'sql' }))
}));

import { db } from '$lib/server/db';
import { eq, isNull } from 'drizzle-orm';
import {
	suppressByEmail,
	suppressSelfService,
	clearSelfServiceSuppression
} from './subscriber-service';

// Build an update().set().where().returning() chain resolving to `rows`.
function mockUpdateReturning(rows: unknown[]) {
	const set = vi.fn();
	const where = vi.fn();
	const returning = vi.fn(() => Promise.resolve(rows));
	(db.update as any).mockReturnValue({ set });
	set.mockReturnValue({ where });
	where.mockReturnValue({ returning });
	return { set, where };
}

// Build an update().set().where() chain that resolves without .returning().
function mockUpdate() {
	const set = vi.fn();
	const where = vi.fn(() => Promise.resolve(undefined));
	(db.update as any).mockReturnValue({ set });
	set.mockReturnValue({ where });
	return { set, where };
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('suppressByEmail', () => {
	it('normalizes the email and writes suppressedAt + reason', async () => {
		const { set, where } = mockUpdateReturning([{ id: 'sub-1' }]);

		const result = await suppressByEmail('  Person@Example.COM ', 'bounce');

		expect(result).toBe(true);
		const setArg = set.mock.calls[0][0];
		expect(setArg.suppressionReason).toBe('bounce');
		expect(setArg.suppressedAt).toBeInstanceOf(Date);
		// matched on the normalized email
		expect(eq).toHaveBeenCalledWith('subscriber.email', 'person@example.com');
		expect(where).toHaveBeenCalled();
	});

	it('returns false when no subscriber matches (no-op)', async () => {
		mockUpdateReturning([]);

		const result = await suppressByEmail('unknown@example.com', 'complaint');

		expect(result).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Global self-service opt-out ("unsubscribe from all")
// ---------------------------------------------------------------------------

describe('suppressSelfService', () => {
	it('suppresses the address with the reversible reason', async () => {
		const { set } = mockUpdate();

		await suppressSelfService('sub-1');

		const setArg = set.mock.calls[0][0];
		expect(setArg.suppressionReason).toBe('unsubscribe');
		expect(setArg.suppressedAt).toBeInstanceOf(Date);
	});

	// A bounce or complaint is a fact about the address reported by Postmark.
	// Overwriting it with the weaker reason would let a later opt-in resurrect
	// an address we know is undeliverable.
	it('only applies when not already suppressed, so it cannot mask a bounce', async () => {
		mockUpdate();

		await suppressSelfService('sub-1');

		expect(isNull).toHaveBeenCalledWith('subscriber.suppressedAt');
	});
});

describe('clearSelfServiceSuppression', () => {
	it('lifts the suppression so opting back in actually delivers mail', async () => {
		const { set } = mockUpdate();

		await clearSelfServiceSuppression('sub-1');

		expect(set.mock.calls[0][0]).toEqual({ suppressedAt: null, suppressionReason: null });
	});

	it('is scoped to self-service opt-outs and never clears a bounce or complaint', async () => {
		mockUpdate();

		await clearSelfServiceSuppression('sub-1');

		expect(eq).toHaveBeenCalledWith('subscriber.suppressionReason', 'unsubscribe');
	});
});
