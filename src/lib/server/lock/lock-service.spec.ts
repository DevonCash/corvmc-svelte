import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let selectResults: unknown[][] = [];
let selectCallIndex = 0;
const updateCalls: unknown[] = [];

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
		lockCode: 'lock_code',
		updatedAt: 'updated_at'
	}
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

const mockCreateTemporaryUser = vi.fn().mockResolvedValue(undefined);
const mockRemoveTemporaryUser = vi.fn().mockResolvedValue(undefined);
const mockListLockUsers = vi.fn().mockResolvedValue([]);
const mockGenerateLockCode = vi.fn().mockReturnValue(4242);

vi.mock('./ultraloc-client', () => ({
	createTemporaryUser: (...args: unknown[]) => mockCreateTemporaryUser(...args),
	removeTemporaryUser: (...args: unknown[]) => mockRemoveTemporaryUser(...args),
	listLockUsers: (...args: unknown[]) => mockListLockUsers(...args),
	generateLockCode: (...args: unknown[]) => mockGenerateLockCode(...args)
}));

const { runDailyLockJob } = await import('./lock-service');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// A temporary lock user (type 2) whose access window ended in the past.
const expiredUser = {
	id: 111,
	name: 'Alice',
	type: 2,
	daterange: ['2020-01-01 18:00', '2020-01-01 20:30'] as [string, string]
};
// A temporary user still inside its window (far future).
const activeUser = {
	id: 222,
	name: 'Bob',
	type: 2,
	daterange: ['2999-01-01 18:00', '2999-01-01 20:30'] as [string, string]
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	vi.clearAllMocks();
	selectResults = [];
	selectCallIndex = 0;
	updateCalls.length = 0;
	mockCreateTemporaryUser.mockResolvedValue(undefined);
	mockRemoveTemporaryUser.mockResolvedValue(undefined);
	mockListLockUsers.mockResolvedValue([]);
	mockGenerateLockCode.mockReturnValue(4242);
});

describe('runDailyLockJob', () => {
	it('returns zeros when no reservations need processing', async () => {
		// cleanup: no lock users; provision: no confirmed reservations today
		mockListLockUsers.mockResolvedValue([]);
		selectResults.push([]);

		const result = await runDailyLockJob();

		expect(result.provisioned).toBe(0);
		expect(result.cleaned).toBe(0);
		expect(result.errors).toHaveLength(0);
	});

	it('provisions a door code for confirmed reservations today', async () => {
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
			expect.objectContaining({ name: 'Alice', code: 4242 })
		);
		// The generated code is stored as the reservation's lockCode.
		expect(updateCalls).toContainEqual(expect.objectContaining({ lockCode: '4242' }));
	});

	it('deletes only expired temporary users on cleanup', async () => {
		mockListLockUsers.mockResolvedValue([expiredUser, activeUser]);
		selectResults.push([]); // provision: none

		const result = await runDailyLockJob();

		expect(result.cleaned).toBe(1);
		expect(mockRemoveTemporaryUser).toHaveBeenCalledTimes(1);
		expect(mockRemoveTemporaryUser).toHaveBeenCalledWith(expiredUser.id);
		// Stale codes on yesterday's reservations are cleared.
		expect(updateCalls).toContainEqual(expect.objectContaining({ lockCode: null }));
	});

	it('ignores non-temporary and codeless users on cleanup', async () => {
		mockListLockUsers.mockResolvedValue([
			{ id: 1, name: 'Admin', type: 3 },
			{ id: 2, name: 'Normal', type: 0 },
			{ id: 3, name: 'NoRange', type: 2 } // temporary but no daterange
		]);
		selectResults.push([]);

		const result = await runDailyLockJob();

		expect(result.cleaned).toBe(0);
		expect(mockRemoveTemporaryUser).not.toHaveBeenCalled();
	});

	it('handles provision errors gracefully and continues', async () => {
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
			.mockResolvedValueOnce(undefined);

		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const result = await runDailyLockJob();

		expect(result.provisioned).toBe(1);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]).toContain('res-fail');

		consoleSpy.mockRestore();
	});

	it('handles cleanup deletion errors gracefully', async () => {
		mockListLockUsers.mockResolvedValue([expiredUser]);
		selectResults.push([]);

		mockRemoveTemporaryUser.mockRejectedValueOnce(new Error('not found'));

		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const result = await runDailyLockJob();

		expect(result.cleaned).toBe(0);
		expect(result.errors).toHaveLength(1);

		consoleSpy.mockRestore();
	});
});
