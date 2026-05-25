import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { reservation } from '$lib/server/db/schema/reservation';
import { band, bandMember } from '$lib/server/db/schema/band';
import { eq, and, gte, lte, ne, inArray, sql } from 'drizzle-orm';
import { listUpcoming } from '$lib/server/event/event-service';
import { getPublicUrl, isConfigured } from '$lib/server/storage';
import { getAllBalances } from '$lib/server/finance/credit-service';
import { getSubscription } from '$lib/server/finance/subscription-service';
import { DateTime } from 'luxon';
import type { DashboardResponse } from '$lib/server/db/schema/api';

const TZ = 'America/Los_Angeles';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) return error(401, 'Not authenticated');
	const user = locals.user;

	// Compute current week boundaries (Mon–Sun) in LA timezone
	const now = DateTime.now().setZone(TZ);
	const weekStart = now.startOf('week').toJSDate(); // luxon weeks start Monday
	const weekEnd = now.endOf('week').toJSDate();

	const r2Available = isConfigured();

	// Get the user's active band IDs for band reservation lookup
	const userBands = await db
		.select({ bandId: bandMember.bandId, bandName: band.name })
		.from(bandMember)
		.innerJoin(band, eq(band.id, bandMember.bandId))
		.where(
			and(
				eq(bandMember.userId, user.id),
				eq(bandMember.status, 'active')
			)
		);

	const activeBandIds = userBands.map((b) => b.bandId);
	const bandNameMap = Object.fromEntries(userBands.map((b) => [b.bandId, b.bandName]));

	// Pending invitation count
	const [{ count: pendingInviteCount }] = await db
		.select({ count: sql<number>`cast(count(*) as integer)` })
		.from(bandMember)
		.where(
			and(
				eq(bandMember.userId, user.id),
				eq(bandMember.status, 'pending')
			)
		);

	const [weekReservations, bandWeekReservations, upcomingEvents, credits, subscription] =
		await Promise.all([
			db
				.select()
				.from(reservation)
				.where(
					and(
						eq(reservation.createdByUserId, user.id),
						eq(reservation.bookerType, 'user'),
						gte(reservation.startsAt, weekStart),
						lte(reservation.startsAt, weekEnd),
						ne(reservation.status, 'cancelled')
					)
				)
				.orderBy(reservation.startsAt),

			activeBandIds.length > 0
				? db
						.select()
						.from(reservation)
						.where(
							and(
								eq(reservation.bookerType, 'band'),
								inArray(reservation.bookerId, activeBandIds),
								gte(reservation.startsAt, weekStart),
								lte(reservation.startsAt, weekEnd),
								ne(reservation.status, 'cancelled')
							)
						)
						.orderBy(reservation.startsAt)
				: Promise.resolve([]),

			listUpcoming(4),

			getAllBalances(user.id),

			user.stripeId ? getSubscription(user.stripeId) : Promise.resolve(null)
		]);

	// Merge and sort all reservations by startsAt
	const allReservations = [...weekReservations, ...bandWeekReservations]
		.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

	// Credit usage for sustaining members
	let allocatedThisMonth = 0;
	if (subscription && credits.free_hours != null) {
		allocatedThisMonth = subscription.quantity;
	}
	const usedThisMonth = Math.max(0, allocatedThisMonth - (credits.free_hours ?? 0));

	return json({
		weekReservations: allReservations.map((r) => ({
			id: r.id,
			bookerType: r.bookerType,
			bookerId: r.bookerId,
			bandName: r.bookerType === 'band' ? (bandNameMap[r.bookerId] ?? null) : null,
			status: r.status,
			startsAt: r.startsAt,
			endsAt: r.endsAt,
			notes: r.notes
		})),
		upcomingEvents: upcomingEvents.map((e) => ({
			id: e.id,
			title: e.title,
			startsAt: e.startsAt,
			endsAt: e.endsAt,
			doorsAt: e.doorsAt ? e.doorsAt : null,
			posterUrl: e.posterKey && r2Available ? getPublicUrl(e.posterKey) : null
		})),
		credits,
		subscription,
		allocatedThisMonth,
		usedThisMonth,
		pendingInviteCount
	} satisfies DashboardResponse);
};
