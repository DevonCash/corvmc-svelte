// ---------------------------------------------------------------------------
// Subscription sync DTOs
// ---------------------------------------------------------------------------
// Plain data only (no Stripe types) so the summary is safe to return across the
// remote function boundary to the client. Produced by syncAllSubscriptions() in
// src/lib/server/finance/subscription-sync-service.ts.
// ---------------------------------------------------------------------------

export interface SubscriptionSyncError {
	kind: 'user' | 'band' | 'sweep';
	/** Stripe customer id, band id, or user id depending on `kind`. */
	ref?: string;
	stripeSubscriptionId?: string;
	message: string;
}

export interface SubscriptionSyncSummary {
	/** active/past_due users whose subscription JSON was written. */
	usersUpdated: number;
	/** canceled/unpaid/stale users whose subscription JSON was set null. */
	usersCleared: number;
	/** active/past_due bands set to premium. */
	bandsUpdated: number;
	/** canceled/unpaid/stale bands reset to free. */
	bandsCleared: number;
	/** trialing/incomplete/paused subs left untouched (status ambiguous). */
	skipped: number;
	/** total subscriptions returned by the Stripe sweep. */
	totalScanned: number;
	/** when true, counts are computed but no DB writes are issued. */
	dryRun: boolean;
	errors: SubscriptionSyncError[];
}
