import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let selectResults: unknown[][] = [];
let selectCallIndex = 0;
const insertedRows: unknown[] = [];
let updateCalls: unknown[] = [];

function buildChain() {
	const proxy: any = new Proxy(() => proxy, {
		get(_, prop) {
			if (prop === 'then') {
				const result = selectResults[selectCallIndex] ?? [];
				selectCallIndex++;
				return (resolve: (v: unknown[]) => void) => resolve(result);
			}
			return () => proxy;
		}
	});
	return proxy;
}

vi.mock('$lib/server/db', () => ({
	db: {
		select: () => buildChain(),
		insert: () => ({
			values: (row: unknown) => {
				insertedRows.push(row);
				return Promise.resolve();
			}
		}),
		update: () => {
			const chain: any = new Proxy(() => chain, {
				get(_, prop) {
					if (prop === 'set')
						return (data: unknown) => {
							updateCalls.push(data);
							return chain;
						};
					if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(undefined);
					return () => chain;
				}
			});
			return chain;
		}
	}
}));

vi.mock('$lib/server/db/schema/reservation', () => ({
	reservation: {
		id: 'id',
		status: 'status',
		startsAt: 'starts_at',
		endsAt: 'ends_at',
		createdByUserId: 'created_by_user_id',
		lockAccessId: 'lock_access_id',
		updatedAt: 'updated_at'
	},
	closure: { id: 'id', startsAt: 'starts_at', endsAt: 'ends_at', reason: 'reason' }
}));

vi.mock('$lib/server/db/schema/authentication', () => ({
	user: { id: 'id', name: 'name', email: 'email' }
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn(),
	and: vi.fn(),
	isNull: vi.fn(),
	isNotNull: vi.fn(),
	gte: vi.fn(),
	lt: vi.fn()
}));

vi.mock('$lib/server/reservation/timezone', () => ({
	buildDateInTz: vi.fn((date, time) => new Date(`${date}T${time}:00Z`))
}));

const mockCreateTemporaryUser = vi.fn().mockResolvedValue('temp-user-123');
const mockRemoveTemporaryUser = vi.fn().mockResolvedValue(undefined);

vi.mock('./ultraloc-client', () => ({
	createTemporaryUser: (...args: unknown[]) => mockCreateTemporaryUser(...args),
	removeTemporaryUser: (...args: unknown[]) => mockRemoveTemporaryUser(...args)
}));

const { runDailyLockJob } = await import('./lock-service');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	vi.clearAllMocks();
	selectResults = [];
	selectCallIndex = 0;
	insertedRows.length = 0;
	updateCalls = [];
});

describe('runDailyLockJob', () => {
	it('returns zeros when no reservations need processing', async () => {
		// cleanup query: no yesterday reservations with lockAccessId
		selectResults.push([]);
		// provision query: no confirmed reservations today without lock access
		selectResults.push([]);

		const result = await runDailyLockJob();

		expect(result.provisioned).toBe(0);
		expect(result.cleaned).toBe(0);
		expect(result.errors).toHaveLength(0);
	});

	it('provisions lock access for confirmed reservations today', async () => {
		// cleanup: no yesterday reservations
		selectResults.push([]);
		// provision: one confirmed reservation
		selectResults.push([
			{
				id: 'res-1',
				startsAt: new Date(),
				endsAt: new Date(Date.now() + 3600000),
				createdByUserId: 'user-1',
				memberName: 'Alice'
			}
		]);

		const result = await runDailyLockJob();

		expect(result.provisioned).toBe(1);
		expect(mockCreateTemporaryUser).toHaveBeenCalledWith(
			expect.objectContaining({
				name: 'Alice'
			})
		);
	});

	it('cleans up lock access from yesterday', async () => {
		// cleanup: one reservation with lockAccessId from yesterday
		selectResults.push([{ id: 'res-old', lockAccessId: 'temp-old-123' }]);
		// provision: none
		selectResults.push([]);

		const result = await runDailyLockJob();

		expect(result.cleaned).toBe(1);
		expect(mockRemoveTemporaryUser).toHaveBeenCalledWith('temp-old-123');
	});

	it('handles provision errors gracefully and continues', async () => {
		selectResults.push([]);
		selectResults.push([
			{
				id: 'res-fail',
				startsAt: new Date(),
				endsAt: new Date(),
				createdByUserId: 'u1',
				memberName: 'Bob'
			},
			{
				id: 'res-ok',
				startsAt: new Date(),
				endsAt: new Date(),
				createdByUserId: 'u2',
				memberName: 'Carol'
			}
		]);

		mockCreateTemporaryUser
			.mockRejectedValueOnce(new Error('API timeout'))
			.mockResolvedValueOnce('temp-456');

		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const result = await runDailyLockJob();

		expect(result.provisioned).toBe(1);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]).toContain('res-fail');

		consoleSpy.mockRestore();
	});

	it('handles cleanup errors gracefully', async () => {
		selectResults.push([{ id: 'res-x', lockAccessId: 'temp-bad' }]);
		selectResults.push([]);

		mockRemoveTemporaryUser.mockRejectedValueOnce(new Error('not found'));

		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const result = await runDailyLockJob();

		expect(result.cleaned).toBe(0);
		expect(result.errors).toHaveLength(1);

		consoleSpy.mockRestore();
	});
});
