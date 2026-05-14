import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { reservation } from '$lib/server/db/schema/reservation';
import { eq, and, gte, lte, ne } from 'drizzle-orm';
import { listUpcoming } from '$lib/server/event/event-service';
import { getPublicUrl, isConfigured } from '$lib/server/storage';
import { getAllBalances } from '$lib/server/finance/credit-service';
import { getSubscription } from '$lib/server/finance/subscription-service';
import { DateTime } from 'luxon';

const TZ = 'America/Los_Angeles';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user!;

	// Compute current week boundaries (Mon–Sun) in LA timezone
	const now = DateTime.now().setZone(TZ);
	const weekStart = now.startOf('week').toJSDate(); // luxon weeks start Monday
	const weekEnd = now.endOf('week').toJSDate();

	const r2Available = isConfigured();

	const [weekReservations, upcomingEvents, credits, subscription] = await Promise.all([
		db
			.select()
			.from(reservation)
			.where(
				and(
					eq(reservation.createdByUserId, user.id),
					gte(reservation.startsAt, weekStart),
					lte(reservation.startsAt, weekEnd),
					ne(reservation.status, 'cancelled')
				)
			)
			.orderBy(reservation.startsAt),

		listUpcoming(4),

		getAllBalances(user.id),

		user.stripeId ? getSubscription(user.stripeId) : Promise.resolve(null)
	]);

	// Credit usage for sustaining members
	let allocatedThisMonth = 0;
	if (subscription && credits.free_hours != null) {
		allocatedThisMonth = subscription.quantity;
	}
	const usedThisMonth = Math.max(0, allocatedThisMonth - (credits.free_hours ?? 0));

	return {
		weekReservations: weekReservations.map((r) => ({
			id: r.id,
			bookerType: r.bookerType,
			status: r.status,
			startsAt: r.startsAt.toISOString(),
			endsAt: r.endsAt.toISOString(),
			notes: r.notes
		})),
		upcomingEvents: upcomingEvents.map((e) => ({
			id: e.id,
			title: e.title,
			startsAt: e.startsAt.toISOString(),
			endsAt: e.endsAt.toISOString(),
			doorsAt: e.doorsAt?.toISOString() ?? null,
			posterUrl: e.posterKey && r2Available ? getPublicUrl(e.posterKey) : null
		})),
		credits,
		subscription,
		allocatedThisMonth,
		usedThisMonth
	};
};
