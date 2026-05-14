import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { reservation } from '$lib/server/db/schema/reservation';
import { user } from '$lib/server/db/schema/auth';
import { eq, and, gt, ne, desc } from 'drizzle-orm';

export const load: PageServerLoad = async ({ parent }) => {
	const { band } = await parent();

	const now = new Date();

	const upcoming = await db
		.select({
			id: reservation.id,
			status: reservation.status,
			startsAt: reservation.startsAt,
			endsAt: reservation.endsAt,
			notes: reservation.notes,
			bookedByName: user.name
		})
		.from(reservation)
		.leftJoin(user, eq(user.id, reservation.createdByUserId))
		.where(
			and(
				eq(reservation.bookerType, 'band'),
				eq(reservation.bookerId, band.id),
				gt(reservation.startsAt, now),
				ne(reservation.status, 'cancelled')
			)
		)
		.orderBy(reservation.startsAt)
		.limit(10);

	return {
		upcoming: upcoming.map((r) => ({
			id: r.id,
			status: r.status,
			startsAt: r.startsAt.toISOString(),
			endsAt: r.endsAt.toISOString(),
			notes: r.notes,
			bookedByName: r.bookedByName
		}))
	};
};
