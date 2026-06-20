import { describe, it, expect } from 'vitest';
import {
	deriveReservationPayment,
	chargePaymentRecordId,
	type LegacyCharge
} from './lib/reservation-payment';

const UPDATED = new Date('2026-06-18T12:00:00Z');
const PAID = new Date('2026-06-15T09:00:00Z');

function charge(overrides: Partial<LegacyCharge>): LegacyCharge {
	return {
		id: 1,
		status: 'paid',
		payment_method: null,
		amount: 3000,
		net_amount: 0,
		credits_applied: null,
		paid_at: PAID,
		stripe_payment_intent_id: null,
		stripe_session_id: null,
		...overrides
	};
}

describe('deriveReservationPayment', () => {
	it('online paid → paidAt + real PaymentIntent record, no credits', () => {
		const r = deriveReservationPayment(
			charge({
				status: 'paid',
				payment_method: 'stripe',
				net_amount: 2250,
				stripe_payment_intent_id: 'pi_abc123'
			}),
			{ status: 'completed', updatedAt: UPDATED }
		);
		expect(r.paidAt).toEqual(PAID);
		expect(r.stripePaymentRecordId).toBe('pi_abc123');
		expect(r.cashDueCents).toBe(0);
		expect(r.creditsUsed).toBeNull();
		expect(r.refundedAt).toBeNull();
	});

	it('cash paid → paidAt + deterministic synthetic record', () => {
		const r = deriveReservationPayment(
			charge({ id: 42, status: 'paid', payment_method: 'venmo', net_amount: 3000 }),
			{ status: 'confirmed', updatedAt: UPDATED }
		);
		expect(r.paidAt).toEqual(PAID);
		expect(r.stripePaymentRecordId).toBe('legacy_charge_42');
		expect(r.cashDueCents).toBe(0);
		expect(r.creditsUsed).toBeNull();
	});

	it('covered_by_credits → no paidAt, credits in hours (blocks ÷ 2)', () => {
		const r = deriveReservationPayment(
			charge({
				status: 'covered_by_credits',
				payment_method: 'credits',
				net_amount: 0,
				credits_applied: { free_hours: 5 }
			}),
			{ status: 'confirmed', updatedAt: UPDATED }
		);
		expect(r.paidAt).toBeNull();
		expect(r.cashDueCents).toBe(0);
		expect(r.creditsUsed).toBe(2.5);
		expect(r.stripePaymentRecordId).toBeNull();
	});

	it('legacy paid/null with net 0 + credits → treated as paid with credits', () => {
		const r = deriveReservationPayment(
			charge({
				status: 'paid',
				payment_method: null,
				amount: 300000,
				net_amount: 0,
				credits_applied: '{"free_hours":4}'
			}),
			{ status: 'completed', updatedAt: UPDATED }
		);
		expect(r.paidAt).toBeNull();
		expect(r.creditsUsed).toBe(2);
		expect(r.cashDueCents).toBe(0);
		expect(r.stripePaymentRecordId).toBeNull();
	});

	it('comped charge → all null except cashDueCents 0', () => {
		const r = deriveReservationPayment(
			charge({ status: 'comped', payment_method: 'comp', net_amount: 0, credits_applied: null }),
			{ status: 'confirmed', updatedAt: UPDATED }
		);
		expect(r.paidAt).toBeNull();
		expect(r.creditsUsed).toBeNull();
		expect(r.cashDueCents).toBe(0);
		expect(r.stripePaymentRecordId).toBeNull();
	});

	it('no charge + settled → comped (cashDueCents 0)', () => {
		const r = deriveReservationPayment(null, { status: 'completed', updatedAt: UPDATED });
		expect(r).toEqual({
			paidAt: null,
			refundedAt: null,
			cashDueCents: 0,
			creditsUsed: null,
			stripePaymentRecordId: null
		});
	});

	it('no charge + scheduled → unpaid (all null)', () => {
		const r = deriveReservationPayment(null, { status: 'scheduled', updatedAt: UPDATED });
		expect(r.cashDueCents).toBeNull();
		expect(r.paidAt).toBeNull();
	});

	it('pending charge with no money/credits → unpaid when scheduled', () => {
		const r = deriveReservationPayment(
			charge({ status: 'pending', payment_method: null, net_amount: 0, credits_applied: null }),
			{ status: 'scheduled', updatedAt: UPDATED }
		);
		expect(r.cashDueCents).toBeNull();
		expect(r.paidAt).toBeNull();
		expect(r.stripePaymentRecordId).toBeNull();
	});

	it('refunded real money → refundedAt + record link, no paidAt', () => {
		const r = deriveReservationPayment(
			charge({
				id: 7,
				status: 'refunded',
				payment_method: 'stripe',
				net_amount: 3000,
				stripe_payment_intent_id: 'pi_ref'
			}),
			{ status: 'cancelled', updatedAt: UPDATED }
		);
		expect(r.paidAt).toBeNull();
		expect(r.refundedAt).toEqual(PAID);
		expect(r.stripePaymentRecordId).toBe('pi_ref');
	});

	it('credit-only refund (net 0) → no record link, reads as cancelled', () => {
		const r = deriveReservationPayment(
			charge({
				id: 8,
				status: 'refunded',
				payment_method: 'credits',
				net_amount: 0,
				credits_applied: { free_hours: 4 }
			}),
			{ status: 'cancelled', updatedAt: UPDATED }
		);
		expect(r.stripePaymentRecordId).toBeNull();
		expect(r.refundedAt).toBeNull();
		expect(r.paidAt).toBeNull();
	});

	it('online charge with only a session id → links cs_ (no pi_)', () => {
		const r = deriveReservationPayment(
			charge({
				status: 'paid',
				payment_method: 'stripe',
				net_amount: 2250,
				stripe_payment_intent_id: null,
				stripe_session_id: 'cs_test_123'
			}),
			{ status: 'completed', updatedAt: UPDATED }
		);
		expect(r.paidAt).toEqual(PAID);
		expect(r.stripePaymentRecordId).toBe('cs_test_123');
	});

	it('partial credit + cash → paid (paidAt set) and credits recorded', () => {
		const r = deriveReservationPayment(
			charge({
				status: 'paid',
				payment_method: 'stripe',
				net_amount: 1500,
				credits_applied: { free_hours: 2 },
				stripe_payment_intent_id: 'pi_partial'
			}),
			{ status: 'completed', updatedAt: UPDATED }
		);
		expect(r.paidAt).toEqual(PAID);
		expect(r.creditsUsed).toBe(1);
		expect(r.stripePaymentRecordId).toBe('pi_partial');
		expect(r.cashDueCents).toBe(0);
	});

	it('falls back to updatedAt when charge has no paid_at', () => {
		const r = deriveReservationPayment(
			charge({ status: 'paid', net_amount: 3000, paid_at: null }),
			{ status: 'completed', updatedAt: UPDATED }
		);
		expect(r.paidAt).toEqual(UPDATED);
	});
});

describe('chargePaymentRecordId', () => {
	it('prefers the real PaymentIntent', () => {
		expect(chargePaymentRecordId(charge({ stripe_payment_intent_id: 'pi_x' }))).toBe('pi_x');
	});
	it('falls back to a deterministic synthetic id', () => {
		expect(chargePaymentRecordId(charge({ id: 99, stripe_payment_intent_id: null }))).toBe(
			'legacy_charge_99'
		);
	});
});
