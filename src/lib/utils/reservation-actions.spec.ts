import { describe, it, expect } from 'vitest';
import { reservationPaymentState } from './reservation-actions';

describe('reservationPaymentState', () => {
	const base = { status: 'confirmed' as const };

	it('cash/online paid → paid', () => {
		expect(reservationPaymentState({ ...base, paidAt: new Date(), cashDueCents: 0 })).toBe('paid');
	});

	it('cash owed at door → cash_due', () => {
		expect(reservationPaymentState({ ...base, paidAt: null, cashDueCents: 500 })).toBe('cash_due');
	});

	it('not yet settled (scheduled) → unpaid', () => {
		expect(reservationPaymentState({ status: 'scheduled', paidAt: null, cashDueCents: null })).toBe(
			'unpaid'
		);
	});

	it('fully credit-covered → credits (the bug: must not read as comped)', () => {
		expect(
			reservationPaymentState({ ...base, paidAt: null, cashDueCents: 0, creditsUsed: 2 })
		).toBe('credits');
	});

	it('zero-charge waiver → comped', () => {
		expect(
			reservationPaymentState({ ...base, paidAt: null, cashDueCents: 0, creditsUsed: 0 })
		).toBe('comped');
		expect(reservationPaymentState({ ...base, paidAt: null, cashDueCents: 0 })).toBe('comped');
	});

	it('paid takes priority over credits when both present', () => {
		expect(
			reservationPaymentState({ ...base, paidAt: new Date(), cashDueCents: 0, creditsUsed: 1 })
		).toBe('paid');
	});

	it('cancelled with payment → refunded, without → cancelled', () => {
		expect(reservationPaymentState({ status: 'cancelled', stripePaymentRecordId: 'pr_1' })).toBe(
			'refunded'
		);
		expect(reservationPaymentState({ status: 'cancelled' })).toBe('cancelled');
	});

	it('no_show → no_show', () => {
		expect(reservationPaymentState({ status: 'no_show', paidAt: new Date() })).toBe('no_show');
	});
});
