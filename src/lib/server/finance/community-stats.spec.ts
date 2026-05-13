import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock database
// ---------------------------------------------------------------------------
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();

function makeChain(result: unknown[]) {
	mockWhere.mockResolvedValue(result);
	mockFrom.mockReturnValue({ where: mockWhere });
	mockSelect.mockReturnValue({ from: mockFrom });
}

vi.mock('$lib/server/db', () => ({
	db: {
		select: (...args: unknown[]) => mockSelect(...args)
	}
}));

vi.mock('$lib/server/db/schema/auth', () => ({
	user: { id: 'id', credits: 'credits', deletedAt: 'deleted_at' }
}));

vi.mock('$lib/server/db/schema/finance', () => ({
	creditTransaction: {
		userId: 'user_id',
		source: 'source',
		creditType: 'credit_type',
		amount: 'amount',
		createdAt: 'created_at'
	}
}));

// Mock drizzle operators to pass through
vi.mock('drizzle-orm', () => ({
	sql: {},
	eq: vi.fn(),
	and: vi.fn(),
	gte: vi.fn(),
	isNull: vi.fn(),
	count: vi.fn(),
	countDistinct: vi.fn(),
	sum: vi.fn()
}));

const { getCommunityStats, clearStatsCache } = await import('./community-stats');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('getCommunityStats', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		clearStatsCache();
	});

	it('returns aggregated stats from the database', async () => {
		let callCount = 0;
		mockSelect.mockImplementation(() => {
			callCount++;
			if (callCount === 1) {
				// Allocation query
				return {
					from: () => ({
						where: () => Promise.resolve([{ memberCount: 12, totalHours: '47' }])
					})
				};
			}
			// User count query
			return {
				from: () => ({
					where: () => Promise.resolve([{ total: 80 }])
				})
			};
		});

		const stats = await getCommunityStats();

		expect(stats.sustainingMemberCount).toBe(12);
		expect(stats.totalFreeHoursAllocated).toBe(47);
		expect(stats.participationPercent).toBe(15);
	});

	it('returns zeros when no data exists', async () => {
		mockSelect.mockImplementation(() => ({
			from: () => ({
				where: () => Promise.resolve([{ memberCount: 0, totalHours: null, total: 0 }])
			})
		}));

		const stats = await getCommunityStats();

		expect(stats.sustainingMemberCount).toBe(0);
		expect(stats.totalFreeHoursAllocated).toBe(0);
		expect(stats.participationPercent).toBe(0);
	});

	it('caches results and does not re-query within TTL', async () => {
		let callCount = 0;
		mockSelect.mockImplementation(() => {
			callCount++;
			if (callCount <= 2) {
				// First call: allocation + user queries
				return {
					from: () => ({
						where: () => {
							if (callCount === 1) return Promise.resolve([{ memberCount: 5, totalHours: '20' }]);
							return Promise.resolve([{ total: 50 }]);
						}
					})
				};
			}
			// Should not reach here on second getCommunityStats call
			return {
				from: () => ({
					where: () => Promise.resolve([{ memberCount: 99, totalHours: '999', total: 100 }])
				})
			};
		});

		const first = await getCommunityStats();
		const second = await getCommunityStats();

		// Same result, no additional DB calls
		expect(second).toEqual(first);
		expect(callCount).toBe(2); // Only the initial 2 queries
	});

	it('re-queries after cache is cleared', async () => {
		let callCount = 0;
		mockSelect.mockImplementation(() => {
			callCount++;
			return {
				from: () => ({
					where: () => {
						if (callCount % 2 === 1) return Promise.resolve([{ memberCount: callCount, totalHours: '10' }]);
						return Promise.resolve([{ total: 100 }]);
					}
				})
			};
		});

		const first = await getCommunityStats();
		clearStatsCache();
		const second = await getCommunityStats();

		expect(first.sustainingMemberCount).toBe(1);
		expect(second.sustainingMemberCount).toBe(3);
		expect(callCount).toBe(4); // 2 queries per call
	});
});
