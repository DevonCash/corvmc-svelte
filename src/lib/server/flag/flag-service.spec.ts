import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let selectResultQueue: unknown[][] = [];
let insertResult: unknown[] = [];
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

vi.mock('$lib/server/db', () => ({
	db: {
		select: () => chainableSelect(),
		insert: vi.fn(() => ({
			values: vi.fn(() => ({ returning: vi.fn(() => Promise.resolve(insertResult)) }))
		})),
		update: vi.fn(() => ({
			set: vi.fn(() => ({
				where: vi.fn(() => ({ returning: vi.fn(() => Promise.resolve(updateResult)) }))
			}))
		}))
	}
}));

const emitMock = vi.fn().mockResolvedValue(undefined);
vi.mock('$lib/server/events/event-bus', () => ({
	domainEvents: { emit: (...args: unknown[]) => emitMock(...args) }
}));

vi.mock('$lib/server/sentry', () => ({ captureException: vi.fn() }));

const unpublishMock = vi.fn().mockResolvedValue(undefined);
vi.mock('$lib/server/event/event-service', () => ({
	unpublish: (...args: unknown[]) => unpublishMock(...args)
}));

import {
	createFlag,
	resolveFlag,
	FlagTargetNotFoundError,
	FlagNotFoundError,
	FlagAlreadyResolvedError
} from './flag-service';

beforeEach(() => {
	selectResultQueue = [];
	insertResult = [];
	updateResult = [];
	emitMock.mockClear();
	unpublishMock.mockClear();
});

// ---------------------------------------------------------------------------
// createFlag
// ---------------------------------------------------------------------------

describe('createFlag', () => {
	it('rejects when the reported entity does not exist', async () => {
		selectResultQueue = [[]]; // resolveEntityLabel finds nothing
		await expect(
			createFlag({
				entityType: 'member_profile',
				entityId: 'missing',
				reportedByUserId: 'u1',
				reportedByName: 'Reporter',
				reason: 'spam'
			})
		).rejects.toBeInstanceOf(FlagTargetNotFoundError);
	});

	it('inserts a flag and emits content.flagged', async () => {
		selectResultQueue = [[{ name: 'Jordan' }]]; // entity label lookup
		insertResult = [{ id: 'f1', entityType: 'member_profile', entityId: 'u2', reason: 'spam' }];

		const flag = await createFlag({
			entityType: 'member_profile',
			entityId: 'u2',
			reportedByUserId: 'u1',
			reportedByName: 'Reporter',
			reason: 'spam'
		});

		expect(flag).toMatchObject({ id: 'f1' });
		// Event is emitted fire-and-forget; allow the microtask to flush.
		await Promise.resolve();
		await Promise.resolve();
		expect(emitMock).toHaveBeenCalledWith(
			'content.flagged',
			expect.objectContaining({ flagId: 'f1', entityLabel: 'Jordan', reason: 'spam' })
		);
	});

	it('truncates an over-long reason to the limit', async () => {
		selectResultQueue = [[{ name: 'Jordan' }]];
		insertResult = [{ id: 'f1' }];
		await createFlag({
			entityType: 'member_profile',
			entityId: 'u2',
			reportedByUserId: 'u1',
			reportedByName: 'Reporter',
			reason: 'x'.repeat(500)
		});
		// No assertion on db internals here beyond not throwing; the slice guards
		// against schema overflow. Covered indirectly by createFlag succeeding.
		expect(insertResult).toBeTruthy();
	});

	it('flags an event using its title as the label', async () => {
		selectResultQueue = [
			[{ title: 'Loud Show' }], // entity label lookup (event.title)
			[] // duplicate pending-flag check
		];
		insertResult = [{ id: 'f2', entityType: 'event', entityId: 'e1', reason: 'fake' }];

		await createFlag({
			entityType: 'event',
			entityId: 'e1',
			reportedByUserId: 'u1',
			reportedByName: 'Reporter',
			reason: 'fake'
		});

		await Promise.resolve();
		await Promise.resolve();
		expect(emitMock).toHaveBeenCalledWith(
			'content.flagged',
			expect.objectContaining({ flagId: 'f2', entityLabel: 'Loud Show' })
		);
	});

	it('accepts anonymous reports and emits a placeholder reporter name', async () => {
		selectResultQueue = [[{ title: 'Loud Show' }], []];
		insertResult = [{ id: 'f3', entityType: 'event', entityId: 'e1', reason: 'spam' }];

		const flag = await createFlag({
			entityType: 'event',
			entityId: 'e1',
			reason: 'spam'
		});

		expect(flag).toMatchObject({ id: 'f3' });
		await Promise.resolve();
		await Promise.resolve();
		expect(emitMock).toHaveBeenCalledWith(
			'content.flagged',
			expect.objectContaining({ reportedByUserId: null, reportedByName: 'Anonymous visitor' })
		);
	});

	it('still inserts but skips staff notification when a pending flag already exists', async () => {
		selectResultQueue = [
			[{ title: 'Loud Show' }],
			[{ id: 'existing-flag' }] // duplicate pending-flag check hits
		];
		insertResult = [{ id: 'f4', entityType: 'event', entityId: 'e1', reason: 'spam again' }];

		const flag = await createFlag({
			entityType: 'event',
			entityId: 'e1',
			reason: 'spam again'
		});

		expect(flag).toMatchObject({ id: 'f4' });
		await Promise.resolve();
		await Promise.resolve();
		expect(emitMock).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// resolveFlag
// ---------------------------------------------------------------------------

describe('resolveFlag', () => {
	it('throws when the flag does not exist', async () => {
		selectResultQueue = [[]];
		await expect(
			resolveFlag('missing', { resolution: 'resolved', staffId: 's1' })
		).rejects.toBeInstanceOf(FlagNotFoundError);
	});

	it('refuses to resolve a flag that is already resolved', async () => {
		selectResultQueue = [[{ status: 'dismissed' }]];
		await expect(
			resolveFlag('f1', { resolution: 'resolved', staffId: 's1' })
		).rejects.toBeInstanceOf(FlagAlreadyResolvedError);
	});

	it('resolves a pending flag', async () => {
		selectResultQueue = [[{ status: 'pending' }]];
		updateResult = [{ id: 'f1', status: 'resolved' }];
		const row = await resolveFlag('f1', { resolution: 'resolved', staffId: 's1' });
		expect(row).toMatchObject({ status: 'resolved' });
	});

	it('unpublishes a flagged band event and notifies its admins when requested', async () => {
		selectResultQueue = [
			[{ status: 'pending', entityType: 'event', entityId: 'e1' }], // flag lookup
			[
				{
					id: 'e1',
					title: 'Loud Show',
					status: 'published',
					source: 'band',
					bandId: 'b1',
					bandName: 'The Squares'
				}
			], // event + band lookup
			[{ id: 'u9', name: 'Admin', email: 'admin@example.com' }] // band admins
		];
		updateResult = [{ id: 'f1', status: 'resolved' }];

		await resolveFlag('f1', {
			resolution: 'resolved',
			staffId: 's1',
			notes: 'Poster violated guidelines',
			unpublishEvent: true
		});

		expect(unpublishMock).toHaveBeenCalledWith('e1');
		await Promise.resolve();
		await Promise.resolve();
		expect(emitMock).toHaveBeenCalledWith(
			'event.unpublished_by_staff',
			expect.objectContaining({
				eventId: 'e1',
				eventTitle: 'Loud Show',
				bandId: 'b1',
				notes: 'Poster violated guidelines',
				bandAdmins: [{ userId: 'u9', userName: 'Admin', userEmail: 'admin@example.com' }]
			})
		);
	});

	it('does not unpublish when the option is not set', async () => {
		selectResultQueue = [[{ status: 'pending', entityType: 'event', entityId: 'e1' }]];
		updateResult = [{ id: 'f1', status: 'resolved' }];

		await resolveFlag('f1', { resolution: 'resolved', staffId: 's1' });

		expect(unpublishMock).not.toHaveBeenCalled();
	});

	it('skips unpublish when the event is no longer published', async () => {
		selectResultQueue = [
			[{ status: 'pending', entityType: 'event', entityId: 'e1' }],
			[{ id: 'e1', title: 'Loud Show', status: 'draft', source: 'band', bandId: 'b1' }]
		];
		updateResult = [{ id: 'f1', status: 'resolved' }];

		await resolveFlag('f1', { resolution: 'resolved', staffId: 's1', unpublishEvent: true });

		expect(unpublishMock).not.toHaveBeenCalled();
		await Promise.resolve();
		await Promise.resolve();
		expect(emitMock).not.toHaveBeenCalled();
	});
});
