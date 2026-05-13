import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/auth';
import { creditTransaction } from '$lib/server/db/schema/finance';
import { sql, eq, and, gte, isNull, count, countDistinct, sum } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// CommunityStats — aggregated subscription metrics for the membership page
// ---------------------------------------------------------------------------
// Cached in-memory with a 24-hour TTL. These are approximate vanity stats
// displayed on the membership marketing page — freshness doesn't matter.
// ---------------------------------------------------------------------------

export interface CommunityStats {
	sustainingMemberCount: number;
	totalFreeHoursAllocated: number;
	participationPercent: number;
}

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

let cached: { stats: CommunityStats; expiresAt: number } | null = null;

/**
 * Get community impact stats. Returns cached values if available and fresh;
 * otherwise queries the database and caches the result for 24 hours.
 */
export async function getCommunityStats(): Promise<CommunityStats> {
	if (cached && Date.now() < cached.expiresAt) {
		return cached.stats;
	}

	const stats = await queryStats();
	cached = { stats, expiresAt: Date.now() + TTL_MS };
	return stats;
}

/** Invalidate the cache. Useful for testing. */
export function clearStatsCache(): void {
	cached = null;
}

// ---------------------------------------------------------------------------
// Internal query
// ---------------------------------------------------------------------------

async function queryStats(): Promise<CommunityStats> {
	const monthStart = getMonthStart();

	// Count distinct users who received a monthly_allocation this month
	// and sum the total free hours allocated
	const [allocationStats] = await db
		.select({
			memberCount: countDistinct(creditTransaction.userId),
			totalHours: sum(creditTransaction.amount)
		})
		.from(creditTransaction)
		.where(
			and(
				eq(creditTransaction.source, 'monthly_allocation'),
				eq(creditTransaction.creditType, 'free_hours'),
				gte(creditTransaction.createdAt, monthStart)
			)
		);

	const sustainingMemberCount = allocationStats?.memberCount ?? 0;
	const totalFreeHoursAllocated = Number(allocationStats?.totalHours ?? 0);

	// Count total active (non-deleted) users
	const [userStats] = await db
		.select({ total: count() })
		.from(user)
		.where(isNull(user.deletedAt));

	const totalUsers = userStats?.total ?? 0;

	const participationPercent =
		totalUsers > 0 ? Math.round((sustainingMemberCount / totalUsers) * 100 * 10) / 10 : 0;

	return {
		sustainingMemberCount,
		totalFreeHoursAllocated,
		participationPercent
	};
}

/** First day of the current month at midnight in the app timezone (America/Los_Angeles). */
function getMonthStart(): Date {
	// Format current date in app timezone to get the correct local month/year
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: 'America/Los_Angeles',
		year: 'numeric',
		month: 'numeric'
	}).formatToParts(new Date());

	const year = Number(parts.find(p => p.type === 'year')!.value);
	const month = Number(parts.find(p => p.type === 'month')!.value) - 1; // 0-indexed

	// Create a Date representing midnight of the 1st in Los_Angeles.
	// We approximate by using UTC and adjusting for Pacific offset (max 8h behind UTC).
	// For vanity stats with 24h caching, the few-hour boundary edge case is acceptable.
	return new Date(Date.UTC(year, month, 1, 8)); // 00:00 PST = 08:00 UTC
}
