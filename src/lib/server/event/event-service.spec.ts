import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockEventRow = {
	id: 'evt-1',
	title: 'Open Mic Night',
	description: 'Come play!',
	startsAt: new Date('2025-07-15T02:00:00Z'),
	endsAt: new Date('2025-07-15T05:00:00Z'),
	doorsAt: null,
	status: 'draft',
	publishedAt: null,
	reservationId: null,
	posterKey: null,
	tags: 'open mic,music',
	createdByUserId: 'staff-1',
	createdAt: new Date(),
	updatedAt: new Date()
};

// Track what the mock DB does
let selectResult: unknown[] = [];
let updateRowCount = 1;

function chainable(result?: unknown[]) {
	const proxy: any = new Proxy(() => proxy, {
		get(_, prop) {
			if (prop === 'then') {
				return (resolve: (v: unknown[]) => void) => resolve(result ?? selectResult);
			}
			if (prop === 'rowCount') return updateRowCount;
			return () => proxy;
		}
	});
	return proxy;
}

const txMock = {
	insert: vi.fn(() => ({
		values: vi.fn(() => ({
			returning: vi.fn(() => Promise.resolve([{ ...mockEventRow }]))
		}))
	})),
	update: vi.fn(() => ({
		set: vi.fn(() => ({
			where: vi.fn(() => Promise.resolve({ rowCount: updateRowCount }))
		}))
	})),
	select: vi.fn(() => chainable())
};

vi.mock('$lib/server/db', () => ({
	db: {
		select: () => chainable(),
		insert: vi.fn(() => ({
			values: vi.fn(() => ({
				returning: vi.fn(() => Promise.resolve([{ ...mockEventRow }]))
			}))
		})),
		update: vi.fn(() => ({
			set: vi.fn(() => ({
				where: vi.fn(() => ({
					returning: vi.fn(() => Promise.resolve([{ ...mockEventRow }])),
					then: (resolve: any) => resolve({ rowCount: updateRowCount })
				}))
			}))
		})),
		transaction: (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)
	}
}));

vi.mock('$lib/server/reservation/reservation-service', () => ({
	staffCreate: vi.fn().mockResolvedValue({ id: 'res-1' }),
	cancel: vi.fn().mockResolvedValue(undefined),
	ReservationConflictError: class extends Error {
		constructor() {
			super('Time slot is not available');
		}
	}
}));

vi.mock('$lib/server/reservation/conflict-service', () => ({
	hasConflict: vi.fn().mockResolvedValue(false)
}));

vi.mock('$lib/server/storage', () => ({
	uploadFile: vi.fn().mockResolvedValue('events/posters/evt-1.jpg'),
	deleteObject: vi.fn().mockResolvedValue(undefined)
}));

import { create, publish, cancel } from './event-service';
import { staffCreate, cancel as cancelReservation } from '$lib/server/reservation/reservation-service';
import { hasConflict } from '$lib/server/reservation/conflict-service';
import { uploadFile, deleteObject } from '$lib/server/storage';

describe('EventService', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		selectResult = [];
		updateRowCount = 1;
	});

	// -----------------------------------------------------------------------
	// create
	// -----------------------------------------------------------------------

	describe('create', () => {
		const baseParams = {
			title: 'Open Mic Night',
			description: 'Come play!',
			startsAt: new Date('2025-07-15T02:00:00Z'),
			endsAt: new Date('2025-07-15T05:00:00Z'),
			tags: 'open mic,music',
			createdByUserId: 'staff-1'
		};

		it('creates an event without reservation or poster', async () => {
			const result = await create(baseParams);

			expect(result.id).toBe('evt-1');
			expect(txMock.insert).toHaveBeenCalled();
			expect(staffCreate).not.toHaveBeenCalled();
			expect(uploadFile).not.toHaveBeenCalled();
		});

		it('creates linked reservation when reservation params provided', async () => {
			const result = await create({
				...baseParams,
				reservation: {
					startsAt: new Date('2025-07-15T01:00:00Z'),
					endsAt: new Date('2025-07-15T06:00:00Z'),
					overrideConflicts: false
				}
			});

			expect(hasConflict).toHaveBeenCalled();
			expect(staffCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					bookerType: 'event',
					bookerId: 'evt-1',
					status: 'confirmed'
				})
			);
		});

		it('skips conflict check when overrideConflicts is true', async () => {
			await create({
				...baseParams,
				reservation: {
					startsAt: new Date('2025-07-15T01:00:00Z'),
					endsAt: new Date('2025-07-15T06:00:00Z'),
					overrideConflicts: true
				}
			});

			expect(hasConflict).not.toHaveBeenCalled();
			expect(staffCreate).toHaveBeenCalled();
		});

		it('throws when conflict exists and override is false', async () => {
			vi.mocked(hasConflict).mockResolvedValueOnce(true);

			await expect(
				create({
					...baseParams,
					reservation: {
						startsAt: new Date('2025-07-15T01:00:00Z'),
						endsAt: new Date('2025-07-15T06:00:00Z'),
						overrideConflicts: false
					}
				})
			).rejects.toThrow('Time slot is not available');
		});

		it('uploads poster when posterFile provided', async () => {
			const posterBuffer = new ArrayBuffer(1024);

			await create({
				...baseParams,
				posterFile: { buffer: posterBuffer, contentType: 'image/jpeg' }
			});

			expect(uploadFile).toHaveBeenCalledWith(
				posterBuffer,
				'events/posters/evt-1.jpg',
				'image/jpeg'
			);
		});
	});

	// -----------------------------------------------------------------------
	// publish
	// -----------------------------------------------------------------------

	describe('publish', () => {
		it('publishes a draft event', async () => {
			updateRowCount = 1;
			await expect(publish('evt-1')).resolves.toBeUndefined();
		});

		it('throws when event is not in draft status', async () => {
			updateRowCount = 0;
			selectResult = [{ ...mockEventRow, status: 'published' }];

			await expect(publish('evt-1')).rejects.toThrow('Cannot publish');
		});

		it('throws when event does not exist', async () => {
			updateRowCount = 0;
			selectResult = [];

			await expect(publish('evt-999')).rejects.toThrow('Event not found');
		});
	});

	// -----------------------------------------------------------------------
	// cancel
	// -----------------------------------------------------------------------

	describe('cancel', () => {
		it('cancels an event without reservation', async () => {
			selectResult = [{ ...mockEventRow, status: 'draft' }];

			await cancel('evt-1', 'staff-1');

			expect(cancelReservation).not.toHaveBeenCalled();
			expect(deleteObject).not.toHaveBeenCalled();
		});

		it('cancels linked reservation when present', async () => {
			selectResult = [{ ...mockEventRow, status: 'published', reservationId: 'res-1' }];

			await cancel('evt-1', 'staff-1');

			expect(cancelReservation).toHaveBeenCalledWith(
				'res-1',
				'staff-1',
				'Event cancelled',
				{ staffOverride: true }
			);
		});

		it('deletes poster from R2 when present', async () => {
			selectResult = [{ ...mockEventRow, status: 'draft', posterKey: 'events/posters/evt-1.jpg' }];

			await cancel('evt-1', 'staff-1');

			expect(deleteObject).toHaveBeenCalledWith('events/posters/evt-1.jpg');
		});

		it('throws when event is already cancelled', async () => {
			selectResult = [{ ...mockEventRow, status: 'cancelled' }];

			await expect(cancel('evt-1', 'staff-1')).rejects.toThrow('already cancelled');
		});

		it('ignores error if linked reservation is already cancelled', async () => {
			selectResult = [{ ...mockEventRow, status: 'published', reservationId: 'res-1' }];
			vi.mocked(cancelReservation).mockRejectedValueOnce(new Error('Cannot cancel'));

			// Should not throw — error from cancelReservation is caught
			await expect(cancel('evt-1', 'staff-1')).resolves.toBeUndefined();
		});
	});
});
