import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/authentication';
import { creditTransaction } from '$lib/server/db/schema/finance';
import { sql, eq, and, gte, isNull, count, countDistinct, sum } from 'drizzle-orm';
import { buildDateInTz, getPartsInTz } from '$lib/server/reservation/timezone';
import { getJson, putJson } from '$lib/server/kv';
import { DEFAULT_TIMEZONE } from '$lib/config';

export interface CommunityStats {
	sustainingMemberCount: number;
	totalFreeHoursAllocated: number;
	participationPercent: number;
}

const STATS_KEY = 'community-stats';
const TTL_SECONDS = 86400; // 24 hours

export async function getCommunityStats(): Promise<CommunityStats> {
	const cached = await getJson<CommunityStats>(STATS_KEY);
	if (cached) return cached;

	const stats = await queryStats();
	await putJson(STATS_KEY, stats, TTL_SECONDS);
	return stats;
}

async function queryStats(): Promise<CommunityStats> {
	const monthStart = getMonthStart();

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

function getMonthStart(): Date {
	const TZ = DEFAULT_TIMEZONE;
	const now = getPartsInTz(new Date(), TZ);
	return buildDateInTz(
		`${now.year}-${String(now.month).padStart(2, '0')}-01`,
		'00:00',
		TZ
	);
}
