import type Stripe from 'stripe';
import { and, eq, isNotNull, notInArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/authentication';
import { band } from '$lib/server/db/schema/band';
import type { Subscription } from '$lib/server/db/schema/authentication';
import { stripe } from '$lib/server/stripe';
import { getStripeProductId } from './product-config-service';
import { syncFromWebhook } from '$lib/server/band/band-subscription-service';
import type { SubscriptionSyncError, SubscriptionSyncSummary } from '$lib/types/subscription-sync';

// ---------------------------------------------------------------------------
// SubscriptionSyncService — reconcile Stripe subscription *status* into local D1
// ---------------------------------------------------------------------------
// Used as a one-time backfill after the Postgres→D1 migration cutover, and as an
// on-demand safety-net re-run (e.g. a missed webhook). Triggered from the staff
// settings page.
//
// CRITICAL INVARIANT — STATUS SNAPSHOT ONLY, NEVER TOUCH CREDITS.
// Credit balances (user.creditFreeHours / user.creditEquipment) and the
// credit_transaction ledger are migrated from Postgres and owned by the webhook
// handlers going forward. This module must NOT import credit-service or
// recurring-series-service and must never allocate, reset, or modify any credit.
// It only writes the subscription-status fields that are NOT migrated:
// user.subscription, band.tier, band.subscription.
// ---------------------------------------------------------------------------

/** Sanity cap — far above expected membership; aborts a runaway sweep. */
const MAX_SUBSCRIPTIONS = 5000;

/** Statuses that should write a subscription snapshot. */
const WRITE_STATUSES = new Set<Stripe.Subscription.Status>(['active', 'past_due']);
/** Terminal statuses — a record with ONLY these gets cleared (in step 4). */
const TERMINAL_STATUSES = new Set<Stripe.Subscription.Status>([
	'canceled',
	'unpaid',
	'incomplete_expired'
]);
// A customer/band may hold several subscriptions at once (e.g. an old canceled
// one plus a current active one). To stay order-independent, the sweep NEVER
// clears inline. Instead it records every user/band that has a non-terminal
// subscription in a "keep" set; step 4 then clears exactly the local records
// that hold subscription state but are absent from that set. A canceled sub
// therefore can't undo an active sub seen in the same run, regardless of order.
// Non-terminal-but-ambiguous statuses (trialing, incomplete, paused) are kept
// (not cleared) but do not overwrite local state — counted as `skipped`.

export interface SyncOptions {
	dryRun?: boolean;
}

// ---------------------------------------------------------------------------
// syncAllSubscriptions
// ---------------------------------------------------------------------------

export async function syncAllSubscriptions(
	opts: SyncOptions = {}
): Promise<SubscriptionSyncSummary> {
	const dryRun = opts.dryRun ?? false;

	const summary: SubscriptionSyncSummary = {
		usersUpdated: 0,
		usersCleared: 0,
		bandsUpdated: 0,
		bandsCleared: 0,
		skipped: 0,
		totalScanned: 0,
		dryRun,
		errors: []
	};

	const contributionProductId = await getStripeProductId('contribution');
	const seenUserIds = new Set<string>();
	const seenBandIds = new Set<string>();

	// --- Step 1+2+3: sweep all Stripe subscriptions and apply each ----------
	// First auto-paginated `.list` in the repo — `for await` walks every page.
	try {
		for await (const sub of stripe.subscriptions.list({
			status: 'all',
			limit: 100,
			expand: ['data.items', 'data.items.data.price']
		})) {
			summary.totalScanned++;
			if (summary.totalScanned > MAX_SUBSCRIPTIONS) {
				summary.errors.push({
					kind: 'sweep',
					message: `Aborted: exceeded MAX_SUBSCRIPTIONS (${MAX_SUBSCRIPTIONS})`
				});
				break;
			}

			const meta = sub.metadata ?? {};
			try {
				if (meta.subscription_type === 'band_premium' && meta.band_id) {
					await applyBand(sub, meta.band_id, dryRun, summary, seenBandIds);
				} else {
					await applyUser(sub, contributionProductId, dryRun, summary, seenUserIds);
				}
			} catch (err) {
				summary.errors.push({
					kind: meta.subscription_type === 'band_premium' ? 'band' : 'user',
					ref: meta.band_id,
					stripeSubscriptionId: sub.id,
					message: err instanceof Error ? err.message : String(err)
				});
			}
		}
	} catch (err) {
		summary.errors.push({
			kind: 'sweep',
			message: `Stripe sweep failed: ${err instanceof Error ? err.message : String(err)}`
		});
	}

	// --- Step 4: reconcile stale local state --------------------------------
	// Clear users/bands that still hold a local subscription but were not seen
	// in the sweep at all (Stripe no longer returns them). Guarded: if the sweep
	// returned nothing (likely an API failure), skip clearing entirely so a
	// transient blip can't mass-wipe local subscription state.
	const sweepFailed = summary.errors.some((e) => e.kind === 'sweep');
	if (summary.totalScanned === 0 || sweepFailed) {
		if (summary.totalScanned === 0) {
			summary.errors.push({
				kind: 'sweep',
				message: 'Sweep returned zero subscriptions — skipping stale-state clearing'
			});
		}
		return summary;
	}

	await clearStaleUsers(seenUserIds, dryRun, summary);
	await clearStaleBands(seenBandIds, dryRun, summary);

	return summary;
}

// ---------------------------------------------------------------------------
// Band branch — reuse the existing webhook sync verbatim
// ---------------------------------------------------------------------------

async function applyBand(
	sub: Stripe.Subscription,
	bandId: string,
	dryRun: boolean,
	summary: SubscriptionSyncSummary,
	seenBandIds: Set<string>
): Promise<void> {
	if (WRITE_STATUSES.has(sub.status)) {
		// Reuse the webhook sync verbatim — sets tier 'premium' + subscription JSON.
		if (!dryRun) await syncFromWebhook(bandId, sub);
		seenBandIds.add(bandId);
		summary.bandsUpdated++;
	} else if (!TERMINAL_STATUSES.has(sub.status)) {
		// trialing / incomplete / paused — keep local state, don't overwrite.
		seenBandIds.add(bandId);
		summary.skipped++;
	}
	// Terminal: do nothing here. If the band still holds local premium state and
	// has no non-terminal sub, step 4 resets it to free.
}

// ---------------------------------------------------------------------------
// User branch — mirror handleInvoicePaid's mapping, WITHOUT credit allocation
// ---------------------------------------------------------------------------

async function applyUser(
	sub: Stripe.Subscription,
	contributionProductId: string,
	dryRun: boolean,
	summary: SubscriptionSyncSummary,
	seenUserIds: Set<string>
): Promise<void> {
	// Terminal-only subs need no DB lookup — step 4 handles any clearing. Skipping
	// the lookup avoids spurious "no local user" errors for old canceled subs whose
	// customer has since been deleted.
	if (TERMINAL_STATUSES.has(sub.status)) return;

	const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
	if (!customerId) {
		summary.errors.push({
			kind: 'user',
			stripeSubscriptionId: sub.id,
			message: 'Subscription has no customer id'
		});
		return;
	}

	const [member] = await db
		.select({ id: user.id, subscription: user.subscription })
		.from(user)
		.where(eq(user.stripeId, customerId))
		.limit(1);

	if (!member) {
		summary.errors.push({
			kind: 'user',
			ref: customerId,
			stripeSubscriptionId: sub.id,
			message: 'No local user matches this Stripe customer'
		});
		return;
	}

	if (WRITE_STATUSES.has(sub.status)) {
		// Identify the contribution line by product id (mirrors
		// subscription-service.ts:101-107), with a quantity>0 fallback.
		const item =
			sub.items.data.find((i) => {
				const product = i.price.product;
				return (typeof product === 'string' ? product : product?.id) === contributionProductId;
			}) ?? sub.items.data.find((i) => (i.quantity ?? 0) > 0);

		const hoursPerReset = item?.quantity ?? 0;
		// In Stripe v22 the period end lives on the subscription item.
		const periodEnd = item?.current_period_end;
		const creditsResetAt = periodEnd
			? new Date(periodEnd * 1000).toISOString()
			: new Date(Date.now() + 30 * 86400_000).toISOString();

		const existingSub = member.subscription as Subscription | null;
		const subscription: Subscription = {
			// Preserve existing startedAt so re-runs are idempotent (matches
			// webhook-handlers.ts:104).
			startedAt: existingSub?.startedAt ?? new Date().toISOString(),
			stripeSubscriptionId: sub.id,
			hoursPerReset,
			creditsResetAt
		};

		// NOTE: deliberately NO creditService.* calls (unlike handleInvoicePaid).
		if (!dryRun) await db.update(user).set({ subscription }).where(eq(user.id, member.id));
		seenUserIds.add(member.id);
		summary.usersUpdated++;
	} else {
		// Non-terminal but ambiguous (trialing / incomplete / paused) — terminal
		// statuses already returned above. Keep local state, don't overwrite.
		seenUserIds.add(member.id);
		summary.skipped++;
	}
	// Clearing of users with no non-terminal sub happens in step 4 — deliberately
	// WITHOUT creditService.setBalance / cancelAllForUser (unlike
	// handleSubscriptionDeleted, webhook-handlers.ts:156-177).
}

// ---------------------------------------------------------------------------
// Stale-state reconciliation (credit-free)
// ---------------------------------------------------------------------------

async function clearStaleUsers(
	seenUserIds: Set<string>,
	dryRun: boolean,
	summary: SubscriptionSyncSummary
): Promise<void> {
	const seen = [...seenUserIds];
	const where =
		seen.length > 0
			? and(isNotNull(user.subscription), notInArray(user.id, seen))
			: isNotNull(user.subscription);

	const stale = await db.select({ id: user.id }).from(user).where(where);

	for (const row of stale) {
		// Status snapshot only — clear the subscription JSON, never the credits.
		if (!dryRun) await db.update(user).set({ subscription: null }).where(eq(user.id, row.id));
		summary.usersCleared++;
	}
}

async function clearStaleBands(
	seenBandIds: Set<string>,
	dryRun: boolean,
	summary: SubscriptionSyncSummary
): Promise<void> {
	const seen = [...seenBandIds];
	const where =
		seen.length > 0
			? and(isNotNull(band.subscription), notInArray(band.id, seen))
			: isNotNull(band.subscription);

	const stale = await db.select({ id: band.id }).from(band).where(where);

	for (const row of stale) {
		if (!dryRun)
			await db
				.update(band)
				.set({ tier: 'free', subscription: null, updatedAt: new Date() })
				.where(eq(band.id, row.id));
		summary.bandsCleared++;
	}
}
