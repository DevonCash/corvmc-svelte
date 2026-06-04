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
	ticketingEnabled: false,
	ticketPrice: null,
	ticketQuantity: null,
	createdByUserId: 'staff-1',
	createdAt: new Date(),
	updatedAt: new Date()
};

// Track what the mock DB does
let selectResult: unknown[] = [];
let selectResultQueue: unknown[][] = [];
let updateRowCount = 1;

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
			if (prop === 'meta') return { changes: updateRowCount };
			return () => proxy;
		}
	});
	return proxy;
}

let lastInsertedValues: Record<string, unknown> | null = null;
let lastUpdateSet: Record<string, unknown> | null = null;

const txMock = {
	insert: vi.fn(() => ({
		values: vi.fn((vals: Record<string, unknown>) => {
			lastInsertedValues = vals;
			return {
				returning: vi.fn(() => Promise.resolve([{ ...mockEventRow, ...vals }]))
			};
		})
	})),
	update: vi.fn(() => ({
		set: vi.fn((vals: Record<string, unknown>) => {
			lastUpdateSet = vals;
			return {
				where: vi.fn(() => Promise.resolve({ meta: { changes: updateRowCount } }))
			};
		})
	})),
	select: vi.fn(() => chainable())
};

vi.mock('$lib/server/db', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/db')>();
	return {
		...actual,
		db: {
			select: () => chainable(),
			insert: vi.fn(() => ({
				values: vi.fn(() => ({
					returning: vi.fn(() => Promise.resolve([{ ...mockEventRow }]))
				}))
			})),
			update: vi.fn(() => ({
				set: vi.fn((vals: Record<string, unknown>) => {
					lastUpdateSet = vals;
					return {
						where: vi.fn(() => ({
							returning: vi.fn(() => Promise.resolve([{ ...mockEventRow, ...vals }])),
							then: (resolve: any) => resolve({ meta: { changes: updateRowCount } })
						}))
					};
				})
			})),
			transaction: (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)
		}
	};
});

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

import { create, publish, cancel, update, checkRebookNeeded } from './event-service';
import {
	staffCreate,
	cancel as cancelReservation
} from '$lib/server/reservation/reservation-service';
import { hasConflict } from '$lib/server/reservation/conflict-service';
import { uploadFile, deleteObject } from '$lib/server/storage';

describe('EventService', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		selectResult = [];
		selectResultQueue = [];
		updateRowCount = 1;
		lastInsertedValues = null;
		lastUpdateSet = null;
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
			await create({
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

		it('stores ticketing fields when ticketing is enabled', async () => {
			await create({
				...baseParams,
				ticketingEnabled: true,
				ticketPrice: 1500,
				ticketQuantity: 50
			});

			expect(lastInsertedValues).toMatchObject({
				ticketingEnabled: true,
				ticketPrice: 1500,
				ticketQuantity: 50
			});
		});

		it('stores null price and quantity when ticketing is disabled', async () => {
			await create(baseParams);

			expect(lastInsertedValues).toMatchObject({
				ticketingEnabled: false,
				ticketPrice: null,
				ticketQuantity: null
			});
		});

		it('throws when ticketing is enabled but price is missing', async () => {
			await expect(create({ ...baseParams, ticketingEnabled: true })).rejects.toThrow(
				'Ticket price is required'
			);
		});

		it('throws when ticketing is enabled but price is zero', async () => {
			await expect(
				create({ ...baseParams, ticketingEnabled: true, ticketPrice: 0 })
			).rejects.toThrow('Ticket price is required');
		});

		it('allows null ticketQuantity for unlimited capacity', async () => {
			await create({
				...baseParams,
				ticketingEnabled: true,
				ticketPrice: 1000
			});

			expect(lastInsertedValues).toMatchObject({
				ticketingEnabled: true,
				ticketPrice: 1000,
				ticketQuantity: null
			});
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

			expect(cancelReservation).toHaveBeenCalledWith('res-1', 'staff-1', 'Event cancelled', {
				staffOverride: true
			});
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

	// -----------------------------------------------------------------------
	// checkRebookNeeded
	// -----------------------------------------------------------------------

	describe('checkRebookNeeded', () => {
		const resRow = {
			id: 'res-1',
			startsAt: new Date('2025-07-15T01:00:00Z'),
			endsAt: new Date('2025-07-15T06:00:00Z')
		};

		it('returns not needed when event has no reservation', async () => {
			// getById returns event with no reservationId
			selectResult = [{ ...mockEventRow, reservationId: null }];

			const result = await checkRebookNeeded(
				'evt-1',
				new Date('2025-07-15T02:00:00Z'),
				new Date('2025-07-15T05:00:00Z')
			);

			expect(result.needed).toBe(false);
			expect(result.currentReservation).toBeNull();
		});

		it('returns not needed when new times fit within reservation', async () => {
			// First select: getById (event), second select: reservation row
			selectResultQueue = [[{ ...mockEventRow, reservationId: 'res-1' }], [resRow]];

			const result = await checkRebookNeeded(
				'evt-1',
				new Date('2025-07-15T02:00:00Z'), // within 01:00-06:00
				new Date('2025-07-15T05:00:00Z')
			);

			expect(result.needed).toBe(false);
		});

		it('returns needed when event starts earlier than reservation', async () => {
			selectResultQueue = [[{ ...mockEventRow, reservationId: 'res-1' }], [resRow]];

			const result = await checkRebookNeeded(
				'evt-1',
				new Date('2025-07-15T00:30:00Z'), // before 01:00
				new Date('2025-07-15T05:00:00Z')
			);

			expect(result.needed).toBe(true);
			expect(result.reason).toContain('starts earlier');
		});

		it('returns needed when event ends later than reservation', async () => {
			selectResultQueue = [[{ ...mockEventRow, reservationId: 'res-1' }], [resRow]];

			const result = await checkRebookNeeded(
				'evt-1',
				new Date('2025-07-15T02:00:00Z'),
				new Date('2025-07-15T07:00:00Z') // after 06:00
			);

			expect(result.needed).toBe(true);
			expect(result.reason).toContain('ends later');
		});

		it('returns needed with both reasons when extending both directions', async () => {
			selectResultQueue = [[{ ...mockEventRow, reservationId: 'res-1' }], [resRow]];

			const result = await checkRebookNeeded(
				'evt-1',
				new Date('2025-07-15T00:00:00Z'),
				new Date('2025-07-15T08:00:00Z')
			);

			expect(result.needed).toBe(true);
			expect(result.reason).toContain('starts earlier');
			expect(result.reason).toContain('ends later');
		});

		it('returns not needed when times match exactly', async () => {
			selectResultQueue = [[{ ...mockEventRow, reservationId: 'res-1' }], [resRow]];

			const result = await checkRebookNeeded(
				'evt-1',
				new Date('2025-07-15T01:00:00Z'),
				new Date('2025-07-15T06:00:00Z')
			);

			expect(result.needed).toBe(false);
		});
	});

	// -----------------------------------------------------------------------
	// update with rebook
	// -----------------------------------------------------------------------

	describe('update with rebook', () => {
		it('cancels old reservation and creates new one', async () => {
			// getById for the update call
			selectResult = [{ ...mockEventRow, status: 'published', reservationId: 'res-1' }];

			await update('evt-1', {
				startsAt: new Date('2025-07-15T00:00:00Z'),
				endsAt: new Date('2025-07-15T07:00:00Z'),
				rebook: {
					userId: 'staff-1',
					reservationStartsAt: new Date('2025-07-15T00:00:00Z'),
					reservationEndsAt: new Date('2025-07-15T07:00:00Z'),
					overrideConflicts: false
				}
			});

			expect(cancelReservation).toHaveBeenCalledWith(
				'res-1',
				'staff-1',
				'Event times changed — rebooking',
				{ staffOverride: true }
			);
			expect(staffCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					bookerType: 'event',
					bookerId: 'evt-1',
					status: 'confirmed' // published event → confirmed reservation
				})
			);
		});

		it('creates scheduled reservation for draft events', async () => {
			selectResult = [{ ...mockEventRow, status: 'draft', reservationId: 'res-1' }];

			await update('evt-1', {
				rebook: {
					userId: 'staff-1',
					reservationStartsAt: new Date('2025-07-15T00:00:00Z'),
					reservationEndsAt: new Date('2025-07-15T07:00:00Z'),
					overrideConflicts: true
				}
			});

			expect(staffCreate).toHaveBeenCalledWith(expect.objectContaining({ status: 'scheduled' }));
		});

		it('throws on conflict when override is false', async () => {
			selectResult = [{ ...mockEventRow, status: 'published', reservationId: 'res-1' }];
			vi.mocked(hasConflict).mockResolvedValueOnce(true);

			await expect(
				update('evt-1', {
					rebook: {
						userId: 'staff-1',
						reservationStartsAt: new Date('2025-07-15T00:00:00Z'),
						reservationEndsAt: new Date('2025-07-15T07:00:00Z'),
						overrideConflicts: false
					}
				})
			).rejects.toThrow('Time slot is not available');
		});

		it('skips conflict check when override is true', async () => {
			selectResult = [{ ...mockEventRow, status: 'published', reservationId: 'res-1' }];

			await update('evt-1', {
				rebook: {
					userId: 'staff-1',
					reservationStartsAt: new Date('2025-07-15T00:00:00Z'),
					reservationEndsAt: new Date('2025-07-15T07:00:00Z'),
					overrideConflicts: true
				}
			});

			expect(hasConflict).not.toHaveBeenCalled();
			expect(staffCreate).toHaveBeenCalled();
		});

		it('does not rebook when no reservationId on event', async () => {
			selectResult = [{ ...mockEventRow, status: 'published', reservationId: null }];

			await update('evt-1', {
				title: 'New Title',
				rebook: {
					userId: 'staff-1',
					reservationStartsAt: new Date('2025-07-15T00:00:00Z'),
					reservationEndsAt: new Date('2025-07-15T07:00:00Z'),
					overrideConflicts: false
				}
			});

			expect(cancelReservation).not.toHaveBeenCalled();
			expect(staffCreate).not.toHaveBeenCalled();
		});
	});

	// -----------------------------------------------------------------------
	// update ticketing fields
	// -----------------------------------------------------------------------

	describe('update ticketing fields', () => {
		it('enables ticketing with price and quantity', async () => {
			selectResult = [{ ...mockEventRow, status: 'draft' }];

			await update('evt-1', {
				ticketingEnabled: true,
				ticketPrice: 2000,
				ticketQuantity: 100
			});

			expect(lastUpdateSet).toMatchObject({
				ticketingEnabled: true,
				ticketPrice: 2000,
				ticketQuantity: 100
			});
		});

		it('clears price and quantity when disabling ticketing', async () => {
			selectResult = [
				{
					...mockEventRow,
					status: 'draft',
					ticketingEnabled: true,
					ticketPrice: 2000,
					ticketQuantity: 100
				}
			];

			await update('evt-1', {
				ticketingEnabled: false
			});

			expect(lastUpdateSet).toMatchObject({
				ticketingEnabled: false,
				ticketPrice: null,
				ticketQuantity: null
			});
		});

		it('throws when enabling ticketing without price', async () => {
			selectResult = [{ ...mockEventRow, status: 'draft' }];

			await expect(update('evt-1', { ticketingEnabled: true })).rejects.toThrow(
				'Ticket price is required'
			);
		});

		it('throws when enabling ticketing with zero price', async () => {
			selectResult = [{ ...mockEventRow, status: 'draft' }];

			await expect(update('evt-1', { ticketingEnabled: true, ticketPrice: 0 })).rejects.toThrow(
				'Ticket price is required'
			);
		});

		it('updates price independently when ticketingEnabled is not changed', async () => {
			selectResult = [
				{ ...mockEventRow, status: 'draft', ticketingEnabled: true, ticketPrice: 1500 }
			];

			await update('evt-1', { ticketPrice: 2500 });

			expect(lastUpdateSet).toMatchObject({ ticketPrice: 2500 });
			expect(lastUpdateSet).not.toHaveProperty('ticketingEnabled');
		});

		it('rejects update on cancelled event', async () => {
			selectResult = [{ ...mockEventRow, status: 'cancelled' }];

			await expect(update('evt-1', { ticketingEnabled: true, ticketPrice: 1000 })).rejects.toThrow(
				'Cannot update a cancelled event'
			);
		});
	});
});
