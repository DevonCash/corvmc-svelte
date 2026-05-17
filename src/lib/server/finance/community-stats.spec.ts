import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock KV
// ---------------------------------------------------------------------------
let kvStore: Record<string, string> = {};

vi.mock('$lib/server/kv', () => ({
	getJson: vi.fn(async (key: string) => {
		const val = kvStore[key];
		return val ? JSON.parse(val) : null;
	}),
	putJson: vi.fn(async (key: string, value: unknown) => {
		kvStore[key] = JSON.stringify(value);
	})
}));

// ---------------------------------------------------------------------------
// Mock database
// ---------------------------------------------------------------------------
const mockSelect = vi.fn();

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

const { getCommunityStats } = await import('./community-stats');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('getCommunityStats', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		kvStore = {};
	});

	it('returns aggregated stats from the database', async () => {
		let callCount = 0;
		mockSelect.mockImplementation(() => {
			callCount++;
			if (callCount === 1) {
				return {
					from: () => ({
						where: () => Promise.resolve([{ memberCount: 12, totalHours: '47' }])
					})
				};
			}
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

	it('returns cached results from KV without re-querying', async () => {
		kvStore['community-stats'] = JSON.stringify({
			sustainingMemberCount: 5,
			totalFreeHoursAllocated: 20,
			participationPercent: 10
		});

		const stats = await getCommunityStats();

		expect(stats.sustainingMemberCount).toBe(5);
		expect(mockSelect).not.toHaveBeenCalled();
	});

	it('stores result in KV after querying', async () => {
		let callCount = 0;
		mockSelect.mockImplementation(() => {
			callCount++;
			if (callCount === 1) {
				return {
					from: () => ({
						where: () => Promise.resolve([{ memberCount: 8, totalHours: '30' }])
					})
				};
			}
			return {
				from: () => ({
					where: () => Promise.resolve([{ total: 40 }])
				})
			};
		});

		await getCommunityStats();

		const cached = JSON.parse(kvStore['community-stats']);
		expect(cached.sustainingMemberCount).toBe(8);
		expect(cached.totalFreeHoursAllocated).toBe(30);
		expect(cached.participationPercent).toBe(20);
	});
});
