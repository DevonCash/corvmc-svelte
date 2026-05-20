import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockBand = {
	id: 'band-1',
	name: 'The Velvet Underground',
	slug: 'the-velvet-underground',
	bio: 'NYC band',
	ownerId: 'user-owner',
	avatarKey: null,
	createdAt: new Date(),
	updatedAt: new Date()
};

const mockMember = {
	id: 'member-1',
	bandId: 'band-1',
	userId: 'user-2',
	role: 'member',
	position: 'Guitar',
	status: 'pending',
	invitedById: 'user-owner',
	createdAt: new Date()
};

let selectResult: unknown[] = [];
let selectResultQueue: unknown[][] = [];
let deleteResult = { rowCount: 1 };
let insertError: Error | null = null;

function chainable(result?: unknown[]) {
	const proxy: any = new Proxy(() => proxy, {
		get(_, prop) {
			if (prop === 'then') {
				return (resolve: (v: unknown[]) => void) => {
					if (result !== undefined) return resolve(result);
					if (selectResultQueue.length > 0) return resolve(selectResultQueue.shift()!);
					return resolve(selectResult);
				};
			}
			return () => proxy;
		}
	});
	return proxy;
}

const txMock = {
	insert: vi.fn(() => ({
		values: vi.fn(() => ({
			returning: vi.fn(() => {
				if (insertError) return Promise.reject(insertError);
				return Promise.resolve([{ ...mockBand }]);
			})
		}))
	})),
	update: vi.fn(() => ({
		set: vi.fn(() => ({
			where: vi.fn(() => ({
				returning: vi.fn(() => Promise.resolve([{ ...mockBand }]))
			}))
		}))
	})),
	select: vi.fn(() => chainable()),
	delete: vi.fn(() => ({
		where: vi.fn(() => Promise.resolve(deleteResult))
	}))
};

vi.mock('$lib/server/db', () => ({
	db: {
		select: () => chainable(),
		insert: vi.fn(() => ({
			values: vi.fn(() => ({
				returning: vi.fn(() => {
					if (insertError) return Promise.reject(insertError);
					return Promise.resolve([{ ...mockMember }]);
				})
			}))
		})),
		update: vi.fn(() => ({
			set: vi.fn(() => ({
				where: vi.fn(() => ({
					returning: vi.fn(() => Promise.resolve([{ ...mockBand }]))
				}))
			}))
		})),
		delete: vi.fn(() => ({
			where: vi.fn(() => Promise.resolve(deleteResult))
		})),
		batch: vi.fn(() => Promise.resolve([]))
	}
}));

vi.mock('$lib/server/utils/slug', () => ({
	generateSlug: vi.fn((name: string) => name.toLowerCase().replace(/\s+/g, '-')),
	ensureUniqueSlug: vi.fn(async (slug: string) => slug)
}));

vi.mock('$lib/server/reservation/reservation-service', () => ({
	cancel: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('$lib/server/storage', () => ({
	deleteObject: vi.fn().mockResolvedValue(undefined)
}));

import {
	create,
	update,
	deleteBand,
	invite,
	acceptInvitation,
	declineInvitation,
	revokeInvitation,
	removeMember,
	updateMember,
	transferOwnership,
	leaveBand,
	getUserRole,
	BandMemberExistsError,
	CannotRemoveOwnerError,
	OwnerCannotLeaveError,
	BandNotFoundError
} from './band-service';
import { generateSlug, ensureUniqueSlug } from '$lib/server/utils/slug';
import { cancel as cancelReservation } from '$lib/server/reservation/reservation-service';
import { deleteObject } from '$lib/server/storage';

describe('BandService', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		selectResult = [];
		selectResultQueue = [];
		deleteResult = { rowCount: 1 };
		insertError = null;
	});

	// -----------------------------------------------------------------------
	// create
	// -----------------------------------------------------------------------

	describe('create', () => {
		it('creates a band and owner membership via batch', async () => {
			selectResult = [{ ...mockBand }];
			const { db } = await import('$lib/server/db');
			const result = await create('user-owner', { name: 'The Velvet Underground', bio: 'NYC band' });

			expect(generateSlug).toHaveBeenCalledWith('The Velvet Underground');
			expect(ensureUniqueSlug).toHaveBeenCalled();
			expect(db.batch).toHaveBeenCalled();
			expect(result.id).toBe('band-1');
		});
	});

	// -----------------------------------------------------------------------
	// update
	// -----------------------------------------------------------------------

	describe('update', () => {
		it('regenerates slug when name changes', async () => {
			await update('band-1', { name: 'New Name' });

			expect(generateSlug).toHaveBeenCalledWith('New Name');
			expect(ensureUniqueSlug).toHaveBeenCalled();
		});

		it('does not regenerate slug when only bio changes', async () => {
			await update('band-1', { bio: 'Updated bio' });

			expect(generateSlug).not.toHaveBeenCalled();
		});

		it('throws when band not found', async () => {
			const { db } = await import('$lib/server/db');
			vi.mocked(db.update).mockReturnValueOnce({
				set: vi.fn(() => ({
					where: vi.fn(() => ({
						returning: vi.fn(() => Promise.resolve([]))
					}))
				}))
			} as any);

			await expect(update('band-999', { bio: 'test' })).rejects.toThrow(BandNotFoundError);
		});
	});

	// -----------------------------------------------------------------------
	// deleteBand
	// -----------------------------------------------------------------------

	describe('deleteBand', () => {
		it('cancels future reservations and deletes band', async () => {
			selectResultQueue = [
				[{ ...mockBand, avatarKey: 'bands/avatars/band-1.jpg' }], // getById
				[{ id: 'res-1' }, { id: 'res-2' }] // future reservations
			];

			await deleteBand('band-1');

			expect(cancelReservation).toHaveBeenCalledTimes(2);
			expect(deleteObject).toHaveBeenCalledWith('bands/avatars/band-1.jpg');
		});

		it('skips avatar delete when no avatar', async () => {
			selectResultQueue = [
				[{ ...mockBand, avatarKey: null }],
				[] // no future reservations
			];

			await deleteBand('band-1');

			expect(deleteObject).not.toHaveBeenCalled();
		});

		it('throws when band not found', async () => {
			selectResult = [];

			await expect(deleteBand('band-999')).rejects.toThrow(BandNotFoundError);
		});
	});

	// -----------------------------------------------------------------------
	// invite
	// -----------------------------------------------------------------------

	describe('invite', () => {
		it('creates a pending band member row', async () => {
			const result = await invite('band-1', 'user-2', 'member', 'Guitar', 'user-owner');

			expect(result.status).toBe('pending');
		});

		it('throws BandMemberExistsError on unique constraint violation', async () => {
			insertError = new Error('unique constraint violated');

			await expect(
				invite('band-1', 'user-2', 'member', null, 'user-owner')
			).rejects.toThrow(BandMemberExistsError);
		});
	});

	// -----------------------------------------------------------------------
	// acceptInvitation
	// -----------------------------------------------------------------------

	describe('acceptInvitation', () => {
		it('updates status to active', async () => {
			const { db } = await import('$lib/server/db');
			vi.mocked(db.update).mockReturnValueOnce({
				set: vi.fn(() => ({
					where: vi.fn(() => ({
						returning: vi.fn(() => Promise.resolve([{ ...mockMember, status: 'active' }]))
					}))
				}))
			} as any);

			const result = await acceptInvitation('member-1', 'user-2');
			expect(result.status).toBe('active');
		});

		it('throws when invitation not found', async () => {
			const { db } = await import('$lib/server/db');
			vi.mocked(db.update).mockReturnValueOnce({
				set: vi.fn(() => ({
					where: vi.fn(() => ({
						returning: vi.fn(() => Promise.resolve([]))
					}))
				}))
			} as any);

			await expect(acceptInvitation('member-999', 'user-2')).rejects.toThrow(
				'Invitation not found'
			);
		});
	});

	// -----------------------------------------------------------------------
	// declineInvitation / revokeInvitation
	// -----------------------------------------------------------------------

	describe('declineInvitation', () => {
		it('deletes the pending member row', async () => {
			const { db } = await import('$lib/server/db');
			await declineInvitation('member-1', 'user-2');
			expect(db.delete).toHaveBeenCalled();
		});
	});

	describe('revokeInvitation', () => {
		it('deletes the pending member row', async () => {
			const { db } = await import('$lib/server/db');
			await revokeInvitation('member-1');
			expect(db.delete).toHaveBeenCalled();
		});
	});

	// -----------------------------------------------------------------------
	// removeMember
	// -----------------------------------------------------------------------

	describe('removeMember', () => {
		it('deletes an active member row', async () => {
			selectResult = [{ role: 'member' }];
			const { db } = await import('$lib/server/db');

			await removeMember('member-1');
			expect(db.delete).toHaveBeenCalled();
		});

		it('throws CannotRemoveOwnerError when removing owner', async () => {
			selectResult = [{ role: 'owner' }];

			await expect(removeMember('member-1')).rejects.toThrow(CannotRemoveOwnerError);
		});

		it('throws when member not found', async () => {
			selectResult = [];

			await expect(removeMember('member-999')).rejects.toThrow('Member not found');
		});
	});

	// -----------------------------------------------------------------------
	// updateMember
	// -----------------------------------------------------------------------

	describe('updateMember', () => {
		it('updates role and position', async () => {
			selectResult = [{ role: 'member' }];

			await expect(
				updateMember('member-1', { role: 'admin', position: 'Bass' })
			).resolves.not.toThrow();
		});

		it('throws CannotRemoveOwnerError when updating owner', async () => {
			selectResult = [{ role: 'owner' }];

			await expect(
				updateMember('member-1', { role: 'member' })
			).rejects.toThrow(CannotRemoveOwnerError);
		});
	});

	// -----------------------------------------------------------------------
	// transferOwnership
	// -----------------------------------------------------------------------

	describe('transferOwnership', () => {
		it('demotes old owner and promotes new one via batch', async () => {
			selectResult = [{ status: 'active' }];
			const { db } = await import('$lib/server/db');
			await transferOwnership('band-1', 'user-2', 'user-owner');

			expect(db.batch).toHaveBeenCalled();
		});

		it('throws when new owner is not an active member', async () => {
			selectResult = [{ status: 'pending' }];
			await expect(
				transferOwnership('band-1', 'user-2', 'user-owner')
			).rejects.toThrow('New owner must be an active band member');
		});

		it('throws when new owner is not a band member', async () => {
			selectResult = [];
			await expect(
				transferOwnership('band-1', 'user-2', 'user-owner')
			).rejects.toThrow('New owner must be an active band member');
		});
	});

	// -----------------------------------------------------------------------
	// leaveBand
	// -----------------------------------------------------------------------

	describe('leaveBand', () => {
		it('deletes the member row', async () => {
			selectResult = [{ role: 'member' }];
			const { db } = await import('$lib/server/db');

			await leaveBand('band-1', 'user-2');
			expect(db.delete).toHaveBeenCalled();
		});

		it('throws OwnerCannotLeaveError when owner tries to leave', async () => {
			selectResult = [{ role: 'owner' }];

			await expect(leaveBand('band-1', 'user-owner')).rejects.toThrow(OwnerCannotLeaveError);
		});

		it('throws when not a member', async () => {
			selectResult = [];

			await expect(leaveBand('band-1', 'user-999')).rejects.toThrow('Not a member');
		});
	});

	// -----------------------------------------------------------------------
	// getUserRole
	// -----------------------------------------------------------------------

	describe('getUserRole', () => {
		it('returns role for active member', async () => {
			selectResult = [{ role: 'admin', status: 'active' }];

			const role = await getUserRole('band-1', 'user-2');
			expect(role).toBe('admin');
		});

		it('returns null for non-member', async () => {
			selectResult = [];

			const role = await getUserRole('band-1', 'user-999');
			expect(role).toBeNull();
		});
	});
});
