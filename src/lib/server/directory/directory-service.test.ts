import { describe, it, expect, vi, beforeEach } from 'vitest';

// getPublicDirectory aggregates listPublicMembers + listPublicBands, which hit
// D1 via `db.query.*.findMany` and R2 via resolveImageUrl. Mock at those
// boundaries so the real aggregation/try-catch runs without a DB or storage.
const { userFindMany, bandFindMany, captureException } = vi.hoisted(() => ({
	userFindMany: vi.fn(),
	bandFindMany: vi.fn(),
	captureException: vi.fn()
}));

vi.mock('$lib/server/db', () => ({
	db: { query: { user: { findMany: userFindMany }, band: { findMany: bandFindMany } } }
}));
vi.mock('$lib/server/storage', () => ({ resolveImageUrl: (k: string | null) => k }));
vi.mock('$lib/server/sentry', () => ({ captureException }));

import { getPublicDirectory } from './directory-service';

describe('getPublicDirectory', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns a safe fallback (does not reject) when an underlying query throws', async () => {
		userFindMany.mockRejectedValue(new Error('D1 boom'));
		bandFindMany.mockResolvedValue([]);

		const result = await getPublicDirectory({});

		expect(result).toEqual({ members: [], bands: [], failed: true });
		expect(captureException).toHaveBeenCalledOnce();
	});

	it('returns members and bands with failed=false on success', async () => {
		userFindMany.mockResolvedValue([]);
		bandFindMany.mockResolvedValue([]);

		const result = await getPublicDirectory({});

		expect(result.members).toEqual([]);
		expect(result.bands).toEqual([]);
		expect(result.failed).toBe(false);
		expect(captureException).not.toHaveBeenCalled();
	});
});
