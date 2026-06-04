import type { CreditType } from '$lib/server/db/schema/finance';
import type { PricingTier } from '$lib/server/db/schema/equipment';

// ---------------------------------------------------------------------------
// Site
// ---------------------------------------------------------------------------

export const DEFAULT_TIMEZONE = 'America/Los_Angeles';

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export const SEARCH_LIMIT = 20;
export const LIST_LIMIT = 100;

// ---------------------------------------------------------------------------
// Finance
// ---------------------------------------------------------------------------

export const DOLLARS_PER_UNIT = 5;

export const creditTypeConfig: Record<CreditType, { maxBalance: number | null }> = {
	free_hours: { maxBalance: null },
	equipment_credits: { maxBalance: 250 }
};

// ---------------------------------------------------------------------------
// Equipment pricing
// ---------------------------------------------------------------------------

export const DAILY_RATE_MAJOR = 500;
export const DAILY_RATE_ACCESSORY = 100;

export function estimateLoanCost(
	pickupDate: Date,
	returnDate: Date,
	pricingTier: PricingTier,
	isSustainingMember: boolean
): number {
	if (pricingTier === 'accessory' && isSustainingMember) return 0;
	const dailyRate = pricingTier === 'major' ? DAILY_RATE_MAJOR : DAILY_RATE_ACCESSORY;
	const ms = returnDate.getTime() - pickupDate.getTime();
	const days = Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
	return dailyRate * days;
}

// ---------------------------------------------------------------------------
// Equipment enum values (used in UI dropdowns)
// ---------------------------------------------------------------------------

export const equipmentConditions = ['excellent', 'good', 'fair', 'poor'] as const;
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
// Inbox enum values
// ---------------------------------------------------------------------------

export const inboxChannels = ['email', 'sms', 'web', 'instagram', 'messenger'] as const;
export const inboxThreadStatuses = ['open', 'resolved', 'snoozed'] as const;
export const inboxMessageDirections = ['inbound', 'outbound'] as const;
