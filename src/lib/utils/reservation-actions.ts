export type ReservationActionKey =
	| 'confirm'
	| 'cashReceived'
	| 'comp'
	| 'complete'
	| 'noShow'
	| 'cancel'
	| 'refund';

export type ReservationPaymentState =
	| 'paid'
	| 'cash_due'
	| 'unpaid'
	| 'credits'
	| 'comped'
	| 'cancelled'
	| 'refunded'
	| 'no_show';

/**
 * Derive a reservation's payment state for display. Order matters:
 * paidAt (cash/online) → cash owed → not-yet-settled → credit-settled → comped.
 * Credit-settled and comped share `paidAt null & cashDueCents 0`; `creditsUsed`
 * is what distinguishes them.
 */
export function reservationPaymentState(r: {
	status: string;
	paidAt?: Date | null;
	cashDueCents?: number | null;
	creditsUsed?: number | null;
	stripePaymentRecordId?: string | null;
}): ReservationPaymentState {
	if (r.status === 'no_show') return 'no_show';
	if (r.status === 'cancelled') return r.stripePaymentRecordId ? 'refunded' : 'cancelled';
	if (r.paidAt) return 'paid';
	if ((r.cashDueCents ?? 0) > 0) return 'cash_due';
	if (r.status === 'scheduled') return 'unpaid';
	if ((r.creditsUsed ?? 0) > 0) return 'credits';
	return 'comped';
}

export function visibleActions(
	status: string,
	startsAt: Date,
	endsAt: Date,
	stripePaymentRecordId?: string | null,
	now: Date = new Date(),
	opts?: { cashDueCents?: number | null; paidAt?: Date | null }
): Set<ReservationActionKey> {
	const actions = new Set<ReservationActionKey>();
	const start = startsAt;
	const end = endsAt;
	const cashOwed = !opts?.paidAt && (opts?.cashDueCents ?? 0) > 0;

	if (status === 'scheduled') {
		actions.add('confirm');
		actions.add('cashReceived');
		actions.add('comp');
		actions.add('cancel');
		if (now >= start) actions.add('noShow');
	}

	if (status === 'confirmed') {
		actions.add('cancel');
		if (now >= end) actions.add('complete');
		if (now >= start) actions.add('noShow');
		// Credits committed at Confirm, cash still owed → staff can record cash.
		if (cashOwed) actions.add('cashReceived');
	}

	if (stripePaymentRecordId && (status === 'confirmed' || status === 'completed')) {
		actions.add('refund');
	}

	return actions;
}
