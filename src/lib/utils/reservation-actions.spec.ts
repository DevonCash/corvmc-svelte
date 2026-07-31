import { describe, it, expect } from 'vitest';
import { isTerminalStatus, reservationPaymentState, visibleActions } from './reservation-actions';

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

	it('confirmed with credits never committed (staff-created) → unpaid, not comped', () => {
		expect(reservationPaymentState({ ...base, paidAt: null, cashDueCents: null })).toBe('unpaid');
	});

	it('completed with credits never committed → unpaid, not comped', () => {
		expect(reservationPaymentState({ status: 'completed', paidAt: null, cashDueCents: null })).toBe(
			'unpaid'
		);
	});
});

describe('isTerminalStatus', () => {
	it('treats completed, cancelled, and no_show as terminal', () => {
		expect(isTerminalStatus('completed')).toBe(true);
		expect(isTerminalStatus('cancelled')).toBe(true);
		expect(isTerminalStatus('no_show')).toBe(true);
	});

	it('treats live statuses as non-terminal', () => {
		expect(isTerminalStatus('scheduled')).toBe(false);
		expect(isTerminalStatus('confirmed')).toBe(false);
		expect(isTerminalStatus('waitlisted')).toBe(false);
	});
});

describe('visibleActions cash tracking', () => {
	const past = new Date(Date.now() - 2 * 60 * 60 * 1000);
	const pastEnd = new Date(Date.now() - 60 * 60 * 1000);

	it('offers cashReceived for confirmed rows with committed cash due', () => {
		const actions = visibleActions('confirmed', past, pastEnd, null, new Date(), {
			cashDueCents: 1500,
			paidAt: null
		});
		expect(actions.has('cashReceived')).toBe(true);
	});

	it('offers cashReceived for confirmed rows with credits never committed (staff-created)', () => {
		const actions = visibleActions('confirmed', past, pastEnd, null, new Date(), {
			cashDueCents: null,
			paidAt: null
		});
		expect(actions.has('cashReceived')).toBe(true);
	});

	it('does not offer cashReceived once settled or paid', () => {
		expect(
			visibleActions('confirmed', past, pastEnd, null, new Date(), {
				cashDueCents: 0,
				paidAt: null
			}).has('cashReceived')
		).toBe(false);
		expect(
			visibleActions('confirmed', past, pastEnd, null, new Date(), {
				cashDueCents: 1500,
				paidAt: new Date()
			}).has('cashReceived')
		).toBe(false);
	});
});
