import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies before importing the module under test
// ---------------------------------------------------------------------------

const { txSelect, txInsert } = vi.hoisted(() => ({
	txSelect: vi.fn(),
	txInsert: vi.fn()
}));

vi.mock('$lib/server/db', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/db')>();
	return {
		...actual,
		db: {
			select: txSelect,
			insert: txInsert,
			update: vi.fn()
		}
	};
});

vi.mock('./conflict-service', () => ({
	validateBooking: vi.fn(),
	hasConflict: vi.fn()
}));

vi.mock('$lib/server/finance/payment-service', () => ({
	refund: vi.fn()
}));

import {
	create,
	cancel,
	staffCreate,
	confirm,
	markComplete,
	markNoShow,
	recordCashAndComplete,
	autoCompleteExpired
} from './reservation-service';
import { validateBooking } from './conflict-service';
import { refund } from '$lib/server/finance/payment-service';
import { db } from '$lib/server/db';

describe('ReservationService', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	describe('create', () => {
		const params = {
			userId: 'user-1',
			bookerType: 'user' as const,
			bookerId: 'user-1',
			startsAt: new Date('2025-07-15T17:00:00Z'),
			endsAt: new Date('2025-07-15T19:00:00Z'),
			notes: 'Practice drums'
		};

		it('creates a reservation when validation passes and no conflict', async () => {
			vi.mocked(validateBooking).mockResolvedValue({ valid: true });

			// tx.select for conflict check — no conflicts
			const txWhere = vi.fn().mockResolvedValue([]);
			const txFrom = vi.fn().mockReturnValue({ where: txWhere });
			txSelect.mockReturnValue({ from: txFrom });

			// tx.insert for the new reservation
			const mockRow = { id: 'res-1', ...params, status: 'scheduled', createdByUserId: 'user-1' };
			const returning = vi.fn().mockResolvedValue([mockRow]);
			const values = vi.fn().mockReturnValue({ returning });
			txInsert.mockReturnValue({ values });

			const result = await create(params);

			expect(validateBooking).toHaveBeenCalledWith(params.startsAt, params.endsAt);
			expect(result.id).toBe('res-1');
		});

		it('throws ReservationValidationError when time is invalid', async () => {
			vi.mocked(validateBooking).mockResolvedValue({ valid: false, error: 'Too short' });

			await expect(create(params)).rejects.toThrow('Too short');
		});

		it('throws ReservationConflictError when slot is taken', async () => {
			vi.mocked(validateBooking).mockResolvedValue({ valid: true });

			// tx.select returns a conflicting row
			const txWhere = vi.fn().mockResolvedValue([{ id: 'existing-res' }]);
			const txFrom = vi.fn().mockReturnValue({ where: txWhere });
			txSelect.mockReturnValue({ from: txFrom });

			await expect(create(params)).rejects.toThrow('Time slot is not available');
		});
	});

	describe('cancel', () => {
		function setupSelectMock(row: Record<string, unknown>) {
			const limit = vi.fn().mockResolvedValue([row]);
			const where = vi.fn().mockReturnValue({ limit });
			const from = vi.fn().mockReturnValue({ where });
			vi.mocked(db.select).mockReturnValue({ from } as any);
		}

		function setupUpdateMock(rowCount: number) {
			const updateWhere = vi.fn().mockResolvedValue({ meta: { changes: rowCount } });
			const set = vi.fn().mockReturnValue({ where: updateWhere });
			vi.mocked(db.update).mockReturnValue({ set } as any);
			return set;
		}

		it('cancels a scheduled reservation without refund', async () => {
			setupSelectMock({
				id: 'res-1',
				createdByUserId: 'user-1',
				status: 'scheduled',
				stripePaymentRecordId: null,
				startsAt: new Date('2025-07-15T17:00:00Z'),
				endsAt: new Date('2025-07-15T19:00:00Z')
			});
			const set = setupUpdateMock(1);

			await cancel('res-1', 'user-1', 'Changed plans');

			expect(set).toHaveBeenCalledWith(
				expect.objectContaining({ status: 'cancelled', cancellationReason: 'Changed plans' })
			);
			expect(refund).not.toHaveBeenCalled();
		});

		it('cancels a confirmed reservation and triggers refund', async () => {
			setupSelectMock({
				id: 'res-1',
				createdByUserId: 'user-1',
				status: 'confirmed',
				stripePaymentRecordId: 'pr_123',
				startsAt: new Date('2025-07-15T17:00:00Z'),
				endsAt: new Date('2025-07-15T19:00:00Z')
			});
			setupUpdateMock(1);

			await cancel('res-1', 'user-1');

			expect(refund).toHaveBeenCalledWith({
				userId: 'user-1',
				stripePaymentRecordId: 'pr_123'
			});
		});

		it('rejects cancellation by non-owner', async () => {
			setupSelectMock({
				id: 'res-1',
				createdByUserId: 'user-1',
				status: 'scheduled',
				stripePaymentRecordId: null
			});

			await expect(cancel('res-1', 'user-2')).rejects.toThrow('Not authorized');
		});

		it('rejects cancellation of already-cancelled reservation', async () => {
			setupSelectMock({
				id: 'res-1',
				createdByUserId: 'user-1',
				status: 'cancelled',
				stripePaymentRecordId: null
			});

			await expect(cancel('res-1', 'user-1')).rejects.toThrow('Cannot cancel');
		});

		it('throws when reservation not found', async () => {
			const limit = vi.fn().mockResolvedValue([]);
			const where = vi.fn().mockReturnValue({ limit });
			const from = vi.fn().mockReturnValue({ where });
			vi.mocked(db.select).mockReturnValue({ from } as any);

			await expect(cancel('res-999', 'user-1')).rejects.toThrow('Reservation not found');
		});

		it('throws when status changed concurrently', async () => {
			setupSelectMock({
				id: 'res-1',
				createdByUserId: 'user-1',
				status: 'scheduled',
				stripePaymentRecordId: null
			});
			setupUpdateMock(0);

			await expect(cancel('res-1', 'user-1')).rejects.toThrow(
				'Reservation status changed concurrently'
			);
		});

		it('allows staff override even if not owner', async () => {
			setupSelectMock({
				id: 'res-1',
				createdByUserId: 'user-1',
				status: 'scheduled',
				stripePaymentRecordId: null,
				startsAt: new Date('2025-07-15T17:00:00Z'),
				endsAt: new Date('2025-07-15T19:00:00Z')
			});
			setupUpdateMock(1);

			await cancel('res-1', 'staff-1', 'Staff cancelled', { staffOverride: true });

			expect(refund).not.toHaveBeenCalled();
		});
	});

	describe('staffCreate', () => {
		function setupInsertMock(row: Record<string, unknown>) {
			const returning = vi.fn().mockResolvedValue([row]);
			const values = vi.fn().mockReturnValue({ returning });
			vi.mocked(db.insert).mockReturnValue({ values } as any);
		}

		it('creates a reservation without validation or conflict check', async () => {
			const mockRow = { id: 'res-1', status: 'confirmed' };
			setupInsertMock(mockRow);

			const result = await staffCreate({
				userId: 'staff-1',
				bookerType: 'user',
				bookerId: 'user-1',
				startsAt: new Date('2025-07-15T17:00:00Z'),
				endsAt: new Date('2025-07-15T19:00:00Z')
			});

			expect(result).toEqual(mockRow);
			expect(validateBooking).not.toHaveBeenCalled();
		});

		it('uses provided status', async () => {
			const mockRow = { id: 'res-2', status: 'scheduled' };
			setupInsertMock(mockRow);

			const result = await staffCreate({
				userId: 'staff-1',
				bookerType: 'user',
				bookerId: 'user-1',
				startsAt: new Date('2025-07-15T17:00:00Z'),
				endsAt: new Date('2025-07-15T19:00:00Z'),
				status: 'scheduled'
			});

			expect(result.status).toBe('scheduled');
		});
	});

	describe('confirm', () => {
		function setupUpdateMock(rowCount: number, selectRow?: Record<string, unknown>) {
			const updateWhere = vi.fn().mockResolvedValue({ meta: { changes: rowCount } });
			const set = vi.fn().mockReturnValue({ where: updateWhere });
			vi.mocked(db.update).mockReturnValue({ set } as any);

			if (selectRow !== undefined) {
				const limit = vi.fn().mockResolvedValue([selectRow]);
				const where = vi.fn().mockReturnValue({ limit });
				const from = vi.fn().mockReturnValue({ where });
				vi.mocked(db.select).mockReturnValue({ from } as any);
			}
		}

		it('confirms a scheduled reservation', async () => {
			setupUpdateMock(1);
			await confirm('res-1');
			expect(db.update).toHaveBeenCalled();
		});

		it('throws when reservation not found', async () => {
			setupUpdateMock(0, undefined);
			const limit = vi.fn().mockResolvedValue([]);
			const where = vi.fn().mockReturnValue({ limit });
			const from = vi.fn().mockReturnValue({ where });
			vi.mocked(db.select).mockReturnValue({ from } as any);

			await expect(confirm('res-999')).rejects.toThrow('Reservation not found');
		});

		it('throws when status is not scheduled', async () => {
			setupUpdateMock(0, { status: 'completed' });

			await expect(confirm('res-1')).rejects.toThrow(
				'Cannot transition from "completed" to "confirmed"'
			);
		});
	});

	describe('markComplete', () => {
		function setupUpdateMock(rowCount: number, selectRow?: Record<string, unknown>) {
			const updateWhere = vi.fn().mockResolvedValue({ meta: { changes: rowCount } });
			const set = vi.fn().mockReturnValue({ where: updateWhere });
			vi.mocked(db.update).mockReturnValue({ set } as any);

			if (selectRow !== undefined) {
				const limit = vi.fn().mockResolvedValue([selectRow]);
				const where = vi.fn().mockReturnValue({ limit });
				const from = vi.fn().mockReturnValue({ where });
				vi.mocked(db.select).mockReturnValue({ from } as any);
			}
		}

		it('completes a confirmed reservation', async () => {
			setupUpdateMock(1);
			await markComplete('res-1');
			expect(db.update).toHaveBeenCalled();
		});

		it('throws when reservation has wrong status', async () => {
			setupUpdateMock(0, { status: 'scheduled' });

			await expect(markComplete('res-1')).rejects.toThrow(
				'Cannot transition from "scheduled" to "completed"'
			);
		});
	});

	describe('markNoShow', () => {
		function setupUpdateMock(rowCount: number) {
			const updateWhere = vi.fn().mockResolvedValue({ meta: { changes: rowCount } });
			const set = vi.fn().mockReturnValue({ where: updateWhere });
			vi.mocked(db.update).mockReturnValue({ set } as any);
		}

		it('marks a confirmed reservation as no_show', async () => {
			setupUpdateMock(1);
			await markNoShow('res-1');
			expect(db.update).toHaveBeenCalled();
		});

		it('throws when reservation not found', async () => {
			setupUpdateMock(0);
			const limit = vi.fn().mockResolvedValue([]);
			const where = vi.fn().mockReturnValue({ limit });
			const from = vi.fn().mockReturnValue({ where });
			vi.mocked(db.select).mockReturnValue({ from } as any);

			await expect(markNoShow('res-999')).rejects.toThrow('Reservation not found');
		});
	});

	describe('recordCashAndComplete', () => {
		function setupUpdateMock(rowCount: number) {
			const updateWhere = vi.fn().mockResolvedValue({ meta: { changes: rowCount } });
			const set = vi.fn().mockReturnValue({ where: updateWhere });
			vi.mocked(db.update).mockReturnValue({ set } as any);
		}

		it('transitions scheduled → completed with payment record', async () => {
			setupUpdateMock(1);
			await recordCashAndComplete('res-1', 'pr_abc');
			expect(db.update).toHaveBeenCalled();
		});

		it('throws when reservation not found', async () => {
			setupUpdateMock(0);
			const limit = vi.fn().mockResolvedValue([]);
			const where = vi.fn().mockReturnValue({ limit });
			const from = vi.fn().mockReturnValue({ where });
			vi.mocked(db.select).mockReturnValue({ from } as any);

			await expect(recordCashAndComplete('res-999', 'pr_abc')).rejects.toThrow(
				'Reservation not found'
			);
		});

		it('throws when reservation is not scheduled', async () => {
			setupUpdateMock(0);
			const limit = vi.fn().mockResolvedValue([{ status: 'confirmed' }]);
			const where = vi.fn().mockReturnValue({ limit });
			const from = vi.fn().mockReturnValue({ where });
			vi.mocked(db.select).mockReturnValue({ from } as any);

			await expect(recordCashAndComplete('res-1', 'pr_abc')).rejects.toThrow(
				'Expected status "scheduled", got "confirmed"'
			);
		});
	});

	describe('autoCompleteExpired', () => {
		it('returns the number of rows updated', async () => {
			const updateWhere = vi.fn().mockResolvedValue({ meta: { changes: 3 } });
			const set = vi.fn().mockReturnValue({ where: updateWhere });
			vi.mocked(db.update).mockReturnValue({ set } as any);

			const count = await autoCompleteExpired();
			expect(count).toBe(3);
		});

		it('returns 0 when no expired reservations', async () => {
			const updateWhere = vi.fn().mockResolvedValue({ meta: { changes: 0 } });
			const set = vi.fn().mockReturnValue({ where: updateWhere });
			vi.mocked(db.update).mockReturnValue({ set } as any);

			const count = await autoCompleteExpired();
			expect(count).toBe(0);
		});
	});
});
