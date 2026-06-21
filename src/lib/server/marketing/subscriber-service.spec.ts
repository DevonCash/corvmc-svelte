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
	sql: vi.fn(() => ({ op: 'sql' }))
}));

import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { suppressByEmail } from './subscriber-service';

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
