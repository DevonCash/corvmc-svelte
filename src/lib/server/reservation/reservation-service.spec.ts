import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing the module under test
vi.mock('$lib/server/db', () => ({
	db: {
		select: vi.fn(),
		insert: vi.fn(),
		update: vi.fn()
	}
}));

vi.mock('./conflict-service', () => ({
	validateBooking: vi.fn(),
	hasConflict: vi.fn()
}));

vi.mock('$lib/server/finance/payment-service', () => ({
	refund: vi.fn()
}));

import { create, cancel, markComplete, markNoShow, recordCashAndComplete } from './reservation-service';
import { validateBooking, hasConflict } from './conflict-service';
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
			vi.mocked(validateBooking).mockReturnValue({ valid: true });
			vi.mocked(hasConflict).mockResolvedValue(false);

			const mockRow = { id: 'res-1', ...params, status: 'scheduled', createdByUserId: 'user-1' };
			const returning = vi.fn().mockResolvedValue([mockRow]);
			const values = vi.fn().mockReturnValue({ returning });
			vi.mocked(db.insert).mockReturnValue({ values } as any);

			const result = await create(params);

			expect(validateBooking).toHaveBeenCalledWith(params.startsAt, params.endsAt);
			expect(hasConflict).toHaveBeenCalledWith(params.startsAt, params.endsAt);
			expect(result.id).toBe('res-1');
		});

		it('throws ReservationValidationError when time is invalid', async () => {
			vi.mocked(validateBooking).mockReturnValue({ valid: false, error: 'Too short' });

			await expect(create(params)).rejects.toThrow('Too short');
		});

		it('throws ReservationConflictError when slot is taken', async () => {
			vi.mocked(validateBooking).mockReturnValue({ valid: true });
			vi.mocked(hasConflict).mockResolvedValue(true);

			await expect(create(params)).rejects.toThrow('Time slot is not available');
		});
	});

	describe('cancel', () => {
		it('cancels a scheduled reservation without refund', async () => {
			const mockRow = {
				id: 'res-1',
				createdByUserId: 'user-1',
				status: 'scheduled',
				stripePaymentRecordId: null
			};

			const limit = vi.fn().mockResolvedValue([mockRow]);
			const where = vi.fn().mockReturnValue({ limit });
			const from = vi.fn().mockReturnValue({ where });
			vi.mocked(db.select).mockReturnValue({ from } as any);

			const updateWhere = vi.fn().mockResolvedValue(undefined);
			const set = vi.fn().mockReturnValue({ where: updateWhere });
			vi.mocked(db.update).mockReturnValue({ set } as any);

			await cancel('res-1', 'user-1', 'Changed plans');

			expect(set).toHaveBeenCalledWith(
				expect.objectContaining({ status: 'cancelled', cancellationReason: 'Changed plans' })
			);
			expect(refund).not.toHaveBeenCalled();
		});

		it('cancels a confirmed reservation and triggers refund', async () => {
			const mockRow = {
				id: 'res-1',
				createdByUserId: 'user-1',
				status: 'confirmed',
				stripePaymentRecordId: 'pr_123'
			};

			const limit = vi.fn().mockResolvedValue([mockRow]);
			const where = vi.fn().mockReturnValue({ limit });
			const from = vi.fn().mockReturnValue({ where });
			vi.mocked(db.select).mockReturnValue({ from } as any);

			const updateWhere = vi.fn().mockResolvedValue(undefined);
			const set = vi.fn().mockReturnValue({ where: updateWhere });
			vi.mocked(db.update).mockReturnValue({ set } as any);

			await cancel('res-1', 'user-1');

			expect(refund).toHaveBeenCalledWith({
				userId: 'user-1',
				stripePaymentRecordId: 'pr_123'
			});
		});

		it('rejects cancellation by non-owner', async () => {
			const mockRow = {
				id: 'res-1',
				createdByUserId: 'user-1',
				status: 'scheduled',
				stripePaymentRecordId: null
			};

			const limit = vi.fn().mockResolvedValue([mockRow]);
			const where = vi.fn().mockReturnValue({ limit });
			const from = vi.fn().mockReturnValue({ where });
			vi.mocked(db.select).mockReturnValue({ from } as any);

			await expect(cancel('res-1', 'user-2')).rejects.toThrow('Not authorized');
		});

		it('rejects cancellation of already-cancelled reservation', async () => {
			const mockRow = {
				id: 'res-1',
				createdByUserId: 'user-1',
				status: 'cancelled',
				stripePaymentRecordId: null
			};

			const limit = vi.fn().mockResolvedValue([mockRow]);
			const where = vi.fn().mockReturnValue({ limit });
			const from = vi.fn().mockReturnValue({ where });
			vi.mocked(db.select).mockReturnValue({ from } as any);

			await expect(cancel('res-1', 'user-1')).rejects.toThrow('Cannot cancel');
		});
	});
});
