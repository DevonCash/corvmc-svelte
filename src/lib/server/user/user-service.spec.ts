import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let selectResultQueue: unknown[][] = [];
let updateResult: unknown[] = [];

function chainableSelect() {
	const proxy: any = new Proxy(() => proxy, {
		get(_, prop) {
			if (prop === 'then') {
				return (resolve: (v: unknown[]) => void) =>
					resolve(selectResultQueue.length > 0 ? selectResultQueue.shift()! : []);
			}
			return () => proxy;
		}
	});
	return proxy;
}

const deleteWhere = vi.fn(() => Promise.resolve({ rowCount: 1 }));

vi.mock('$lib/server/db', () => ({
	db: {
		select: () => chainableSelect(),
		update: vi.fn(() => ({
			set: vi.fn(() => ({
				where: vi.fn(() => ({
					returning: vi.fn(() => Promise.resolve(updateResult))
				}))
			}))
		})),
		delete: vi.fn(() => ({ where: deleteWhere }))
	}
}));

const cancelMock = vi.fn().mockResolvedValue(undefined);
vi.mock('$lib/server/reservation/reservation-service', () => ({
	cancel: (...args: unknown[]) => cancelMock(...args)
}));

import {
	deactivateUser,
	deactivateUsers,
	reactivateUser,
	purgeUser,
	UserNotFoundError,
	UserNotDeactivatedError,
	UserHasOwnedBandsError
} from './user-service';

beforeEach(() => {
	selectResultQueue = [];
	updateResult = [];
	cancelMock.mockClear();
	deleteWhere.mockClear();
});

// ---------------------------------------------------------------------------
// deactivateUser
// ---------------------------------------------------------------------------

describe('deactivateUser', () => {
	it('cancels future reservations and returns the row', async () => {
		updateResult = [{ id: 'u1', deletedAt: new Date() }];
		selectResultQueue = [[{ id: 'r1' }, { id: 'r2' }]]; // future reservations

		const row = await deactivateUser('u1');

		expect(row).toMatchObject({ id: 'u1' });
		expect(cancelMock).toHaveBeenCalledTimes(2);
		expect(cancelMock).toHaveBeenCalledWith('r1', 'u1', 'Account deactivated', {
			staffOverride: true
		});
	});

	it('purges the user session rows', async () => {
		updateResult = [{ id: 'u1', deletedAt: new Date() }];
		selectResultQueue = [[]]; // no future reservations

		await deactivateUser('u1');

		expect(deleteWhere).toHaveBeenCalledTimes(1);
	});

	it('throws UserNotFoundError when already deactivated / missing', async () => {
		updateResult = []; // no row updated (deletedAt was already set)
		await expect(deactivateUser('u1')).rejects.toBeInstanceOf(UserNotFoundError);
		expect(deleteWhere).not.toHaveBeenCalled();
	});
});

describe('deactivateUsers', () => {
	it('deactivates multiple users', async () => {
		updateResult = [{ id: 'x', deletedAt: new Date() }];
		selectResultQueue = [[], []]; // future reservations per user

		const res = await deactivateUsers(['u1', 'u2']);

		expect(res.deactivated).toEqual(['u1', 'u2']);
		expect(res.skipped).toEqual([]);
	});

	it('skips skipUserId without touching the DB and skips not-found ids', async () => {
		updateResult = []; // any update finds no row -> UserNotFoundError

		const res = await deactivateUsers(['me', 'u2'], { skipUserId: 'me' });

		expect(res.deactivated).toEqual([]);
		expect(res.skipped).toEqual(['me', 'u2']); // 'me' self-skip, 'u2' already-deactivated/missing
	});
});

describe('reactivateUser', () => {
	it('throws UserNotFoundError when not deactivated', async () => {
		updateResult = [];
		await expect(reactivateUser('u1')).rejects.toBeInstanceOf(UserNotFoundError);
	});
});

// ---------------------------------------------------------------------------
// purgeUser
// ---------------------------------------------------------------------------

describe('purgeUser', () => {
	it('refuses to purge a user that is not deactivated', async () => {
		selectResultQueue = [[{ id: 'u1', deletedAt: null }]];
		await expect(purgeUser('u1')).rejects.toBeInstanceOf(UserNotDeactivatedError);
		expect(deleteWhere).not.toHaveBeenCalled();
	});

	it('refuses to purge a user that still owns a band', async () => {
		selectResultQueue = [
			[{ id: 'u1', deletedAt: new Date() }], // target lookup
			[{ value: 2 }] // owned band count
		];
		await expect(purgeUser('u1')).rejects.toBeInstanceOf(UserHasOwnedBandsError);
		expect(deleteWhere).not.toHaveBeenCalled();
	});

	it('deletes a deactivated user with no owned bands', async () => {
		selectResultQueue = [[{ id: 'u1', deletedAt: new Date() }], [{ value: 0 }]];
		await purgeUser('u1');
		expect(deleteWhere).toHaveBeenCalledTimes(1);
	});

	it('throws UserNotFoundError when the user does not exist', async () => {
		selectResultQueue = [[]];
		await expect(purgeUser('u1')).rejects.toBeInstanceOf(UserNotFoundError);
	});
});
