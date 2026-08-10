import type { CreditType } from '$lib/server/db/schema/finance';
import type { PricingTier } from '$lib/server/db/schema/equipment';

// ---------------------------------------------------------------------------
// Site
// ---------------------------------------------------------------------------

export const DEFAULT_TIMEZONE = 'America/Los_Angeles';

/** Site name appended to every document title, as `<page> | <SITE_NAME>`. */
export const SITE_NAME = 'Corvallis Music Collective';

/** Build a document title. Pass nothing for the bare site name. */
export function pageTitle(title?: string): string {
	return title ? `${title} | ${SITE_NAME}` : SITE_NAME;
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export const SEARCH_LIMIT = 20;
export const LIST_LIMIT = 100;

// ---------------------------------------------------------------------------
// Finance
// ---------------------------------------------------------------------------

export const DOLLARS_PER_UNIT = 5;

// Free-hours credits are stored as 30-minute blocks: one credit covers half an
// hour of practice-room time. The credit currency lives in the data layer (DB,
// services, remotes); the UI presents it as hours via `creditsToHours`, and the
// money path values one credit at half the hourly room rate.
export const MINUTES_PER_CREDIT = 30;

/** Convert a credit count (30-min blocks) to display hours. 24 → 12. */
export function creditsToHours(credits: number): number {
	return (credits * MINUTES_PER_CREDIT) / 60;
}

/** Convert hours of room time to credits (30-min blocks). 1.5h → 3. */
export function hoursToCredits(hours: number): number {
	return Math.round((hours * 60) / MINUTES_PER_CREDIT);
}

/** Cents value of one free-hours credit at a given hourly room rate. */
export function creditValueCents(hourlyRateCents: number): number {
	return Math.round((hourlyRateCents * MINUTES_PER_CREDIT) / 60);
}

// Equipment credits are denominated in cents (1 credit = 1¢ of equipment-loan
// charge), granted 1:1 with the member's monthly contribution. The cap bounds
// rollover hoarding — 25000 = $250 of accrued credit.
export const creditTypeConfig: Record<CreditType, { maxBalance: number | null }> = {
	free_hours: { maxBalance: null },
	equipment_credits: { maxBalance: 25000 }
};

// ---------------------------------------------------------------------------
// Reservations
// ---------------------------------------------------------------------------

/**
 * How many days before its start a member may confirm a reservation *without* a
 * Stripe prepayment. Outside this window only a real Stripe charge (or staff)
 * can confirm. Bounds how far ahead reservations sit confirmed (the single lock
 * has finite user slots) and cuts no-shows.
 */
export const CONFIRMATION_WINDOW_DAYS = 3;

/** The earliest instant a member may confirm a reservation starting at `startsAt`. */
export function confirmWindowOpensAt(startsAt: Date): Date {
	return new Date(startsAt.getTime() - CONFIRMATION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

/** Whether `now` is inside the member confirmation window for `startsAt`. */
export function withinConfirmationWindow(startsAt: Date, now: Date = new Date()): boolean {
	return now.getTime() >= confirmWindowOpensAt(startsAt).getTime();
}

// ---------------------------------------------------------------------------
// Equipment pricing
// ---------------------------------------------------------------------------

export const DAILY_RATE_MAJOR = 500;
export const DAILY_RATE_ACCESSORY = 100;

/** Daily loan rate in cents; accessories are free for sustaining members. */
export function loanDailyRateCents(pricingTier: PricingTier, isSustainingMember: boolean): number {
	if (pricingTier === 'accessory' && isSustainingMember) return 0;
	return pricingTier === 'major' ? DAILY_RATE_MAJOR : DAILY_RATE_ACCESSORY;
}

/** Chargeable loan days: started 24-hour blocks from pickup, minimum one day. */
export function loanChargeDays(from: Date, to: Date): number {
	return Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));
}

// Single formula shared with settlement (loan-service calculateLoanCharge) so
// the quoted estimate and the final charge can only differ by actual
// checkout/return times, never by a different rate or rounding rule.
export function estimateLoanCost(
	pickupDate: Date,
	returnDate: Date,
	pricingTier: PricingTier,
	isSustainingMember: boolean
): number {
	return (
		loanDailyRateCents(pricingTier, isSustainingMember) * loanChargeDays(pickupDate, returnDate)
	);
}

// ---------------------------------------------------------------------------
// Equipment enum values (used in UI dropdowns)
// ---------------------------------------------------------------------------

export const equipmentConditions = ['excellent', 'good', 'fair', 'poor'] as const;

/**
 * Condition is an ordinal scale, so it gets colour rather than four identical
 * ghost badges. Keyed by the same values as `equipmentConditions` — keep in sync.
 */
export const equipmentConditionBadge: Record<(typeof equipmentConditions)[number], string> = {
	excellent: 'badge-success',
	good: 'badge-info',
	fair: 'badge-warning',
	poor: 'badge-error'
};

export const equipmentStatuses = ['available', 'maintenance', 'retired'] as const;
export const pricingTiers = ['major', 'accessory'] as const;
export const loanStatuses = [
	'requested',
	'scheduled',
	'checked_out',
	'returned',
	'cancelled'
] as const;

// ---------------------------------------------------------------------------
// Credit transaction sources
// ---------------------------------------------------------------------------

/**
 * Display labels for `transactionSources`
 * (src/lib/server/db/schema/finance.ts). Kept here rather than in the schema so
 * the staff credits page can import it without pulling in server code.
 * `creditSourceLabels.spec.ts` asserts it stays exhaustive.
 */
export const creditSourceLabels: Record<string, string> = {
	monthly_allocation: 'Monthly allocation',
	checkout: 'Checkout',
	checkout_failed: 'Checkout failed',
	refund: 'Refund',
	cancelled: 'Cancelled',
	admin_adjustment: 'Admin adjustment',
	reservation: 'Reservation'
};

// ---------------------------------------------------------------------------
// Inbox enum values
// ---------------------------------------------------------------------------

export const inboxChannels = ['email', 'sms', 'web', 'instagram', 'messenger'] as const;
export const inboxThreadStatuses = ['open', 'resolved', 'snoozed'] as const;
export const inboxMessageDirections = ['inbound', 'outbound'] as const;

// ---------------------------------------------------------------------------
// Volunteering
// ---------------------------------------------------------------------------

export const volunteerHourStatuses = ['pending', 'approved', 'rejected'] as const;

/**
 * How far back a member may backdate an hour log. Too tight and someone loses a
 * busy season's hours after a stretch of not logging; too loose and the "this
 * quarter" figure keeps moving under the board.
 */
export const VOLUNTEER_BACKDATE_LIMIT_DAYS = 90;

/** 12 hours. The DB check constraint backstops at 24. */
export const VOLUNTEER_MAX_MINUTES_PER_LOG = 720;

export const VOLUNTEER_DESCRIPTION_MAX = 1000;
export const VOLUNTEER_REVIEW_NOTES_MAX = 1000;
export const VOLUNTEER_ROLE_NAME_MAX = 100;
export const VOLUNTEER_ROLE_DESCRIPTION_MAX = 2000;

/** Hours a member may enter per log, as a step for the number input. */
export const VOLUNTEER_HOUR_STEP = 0.25;

/**
 * Today's calendar date in club time, as YYYY-MM-DD.
 *
 * `new Date().toISOString().slice(0, 10)` is the UTC date, which is tomorrow's
 * date in club time from 5pm PT onward — a date-input defaulted that way offers
 * a day the service rejects as being in the future. Client-safe: `$lib/config`
 * carries no server imports.
 */
export function clubToday(): string {
	// en-CA formats as YYYY-MM-DD, which is also what <input type="date"> wants.
	return new Intl.DateTimeFormat('en-CA', { timeZone: DEFAULT_TIMEZONE }).format(new Date());
}

/** Minutes → display hours. 180 → "3 hrs", 90 → "1.5 hrs", 60 → "1 hr". */
export function formatVolunteerHours(minutes: number): string {
	const hours = minutes / 60;
	const rendered = Number.isInteger(hours) ? String(hours) : hours.toFixed(2).replace(/0+$/, '');
	return `${rendered} ${hours === 1 ? 'hr' : 'hrs'}`;
}
