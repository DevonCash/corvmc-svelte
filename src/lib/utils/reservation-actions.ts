export type ReservationActionKey =
	| 'confirm'
	| 'cashReceived'
	| 'comp'
	| 'complete'
	| 'noShow'
	| 'cancel'
	| 'refund';

export function visibleActions(
	status: string,
	startsAt: Date,
	endsAt: Date,
	stripePaymentRecordId?: string | null,
	now: Date = new Date()
): Set<ReservationActionKey> {
	const actions = new Set<ReservationActionKey>();
	const start = startsAt;
	const end = endsAt;

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
	}

	if (stripePaymentRecordId && (status === 'confirmed' || status === 'completed')) {
		actions.add('refund');
	}

	return actions;
}
