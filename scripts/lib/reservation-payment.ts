/**
 * Pure reconstruction of a reservation's payment state from a legacy `charges`
 * row. Used by the pg→D1 migrator (and unit-tested in isolation).
 *
 * The new app's model (see src/lib/utils/reservation-actions.ts):
 *   - paidAt set                          ⇒ real money changed hands (cash/online)
 *   - paidAt null, cashDueCents 0, credits ⇒ paid with credits
 *   - paidAt null, cashDueCents 0, none    ⇒ comped
 *   - paidAt null, cashDueCents null       ⇒ unpaid (scheduled)
 *
 * Legacy truth lives in `charges`, not on the reservation row: `net_amount` is the
 * real cash, `credits_applied` ({"free_hours": N}, N in 30-minute blocks) is the
 * credit coverage, and `stripe_payment_intent_id` links an online payment.
 */

/** A legacy `charges` row (only the columns we read). */
export interface LegacyCharge {
	id: number | string;
	status: string | null;
	payment_method: string | null;
	amount: number | string | null;
	net_amount: number | string | null;
	credits_applied: unknown;
	paid_at: Date | string | null;
	stripe_payment_intent_id: string | null;
	stripe_session_id?: string | null;
}

export interface ReservationPaymentFields {
	paidAt: Date | null;
	refundedAt: Date | null;
	cashDueCents: number | null;
	creditsUsed: number | null;
	stripePaymentRecordId: string | null;
}

/** Mapped reservation status (post `migrateReservations` status mapping). */
export type MappedStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled';

// Mirrors src/lib/config.ts MINUTES_PER_CREDIT — free-hour credits are 30-min blocks.
const MINUTES_PER_CREDIT = 30;

/** Legacy free-hour credits are stored in 30-minute blocks; the app stores hours. */
export function creditBlocksToHours(blocks: number): number {
	return (blocks * MINUTES_PER_CREDIT) / 60;
}

/**
 * Legacy amounts are inconsistently stored (some in cents, some in cents×100).
 * Same normalization as the original exportCashPayments(): values over 10000 are
 * the ×100 form and get divided down.
 */
export function normalizeCents(raw: number | string | null): number {
	const n = Number(raw ?? 0);
	if (!Number.isFinite(n)) return 0;
	return n > 10000 ? Math.round(n / 100) : Math.round(n);
}

function toDate(v: Date | string | null | undefined): Date | null {
	if (!v) return null;
	return v instanceof Date ? v : new Date(v);
}

/** Free-hour blocks covered by a charge's `credits_applied` JSON. */
export function chargeCreditBlocks(creditsApplied: unknown): number {
	let obj = creditsApplied;
	if (typeof obj === 'string') {
		try {
			obj = JSON.parse(obj);
		} catch {
			return 0;
		}
	}
	if (obj && typeof obj === 'object' && 'free_hours' in (obj as Record<string, unknown>)) {
		const n = Number((obj as Record<string, unknown>).free_hours);
		return Number.isFinite(n) ? n : 0;
	}
	return 0;
}

/**
 * The Stripe payment-record id to link, in order of fidelity:
 *   1. the real PaymentIntent (`pi_…`) — refundable via Stripe;
 *   2. the Checkout Session (`cs_…`) — what legacy online charges actually carry,
 *      matching the app's webhook fallback (`session.payment_intent ?? session.id`);
 *   3. a deterministic synthetic id for out-of-band cash/Venmo/manual payments.
 */
export function chargePaymentRecordId(charge: LegacyCharge): string {
	if (charge.stripe_payment_intent_id) return String(charge.stripe_payment_intent_id);
	if (charge.stripe_session_id) return String(charge.stripe_session_id);
	return `legacy_charge_${charge.id}`;
}

/**
 * Derive a reservation's payment fields from its authoritative legacy charge
 * (or null when the reservation has no charge row).
 *
 * `coveredByMembership` handles the legacy quirk that a sustaining member's
 * confirmed booking persisted no charge/ledger entry at all — legacy computed
 * "covered by credits" live from the membership. When there's no charge and the
 * booker was a sustaining member as of the reservation date, treat it as
 * credit-settled (credits_used = durationHours) rather than comped.
 */
export function deriveReservationPayment(
	charge: LegacyCharge | null,
	ctx: {
		status: MappedStatus;
		updatedAt: Date | string | null;
		durationHours?: number;
		coveredByMembership?: boolean;
	}
): ReservationPaymentFields {
	const settled = ctx.status === 'confirmed' || ctx.status === 'completed';
	const empty: ReservationPaymentFields = {
		paidAt: null,
		refundedAt: null,
		// Settled-but-no-money reservations are comped: cashDueCents 0 marks "committed".
		cashDueCents: settled ? 0 : null,
		creditsUsed: null,
		stripePaymentRecordId: null
	};

	if (!charge) {
		// No persisted payment. A sustaining member's confirmed booking was covered
		// by their free hours (legacy showed "covered by credits"); everything else
		// with no charge is a comp.
		if (settled && ctx.coveredByMembership && (ctx.durationHours ?? 0) > 0) {
			return {
				paidAt: null,
				refundedAt: null,
				cashDueCents: 0,
				creditsUsed: ctx.durationHours!,
				stripePaymentRecordId: null
			};
		}
		return empty;
	}

	const chargeStatus = String(charge.status ?? '').toLowerCase();
	const netCents = normalizeCents(charge.net_amount);
	const creditBlocks = chargeCreditBlocks(charge.credits_applied);
	const creditsUsed = creditBlocks > 0 ? creditBlocksToHours(creditBlocks) : null;
	const paidAt = toDate(charge.paid_at) ?? toDate(ctx.updatedAt);

	// Refunded real money: keep the record link so the cancelled reservation reads
	// as "refunded". Credit-only/void refunds returned no money, so they fall through
	// to be treated as a plain cancellation (no record id → reads as "cancelled").
	if (chargeStatus === 'refunded' && netCents > 0) {
		return {
			paidAt: null,
			refundedAt: toDate(charge.paid_at) ?? toDate(ctx.updatedAt),
			cashDueCents: 0,
			creditsUsed,
			stripePaymentRecordId: chargePaymentRecordId(charge)
		};
	}
	if (chargeStatus === 'refunded') return empty;

	// Voided charge — treat as if there were no settlement.
	if (chargeStatus === 'cancelled') return empty;

	// Real money (incl. partial credit + cash): paid.
	if (netCents > 0) {
		return {
			paidAt,
			refundedAt: null,
			cashDueCents: 0,
			creditsUsed,
			stripePaymentRecordId: chargePaymentRecordId(charge)
		};
	}

	// No cash, credits cover it: paid with credits.
	if (creditBlocks > 0) {
		return {
			paidAt: null,
			refundedAt: null,
			cashDueCents: 0,
			creditsUsed,
			stripePaymentRecordId: null
		};
	}

	// No money, no credits: comped (when settled) or untouched.
	return empty;
}
