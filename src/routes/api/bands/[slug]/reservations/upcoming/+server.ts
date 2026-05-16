import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBySlug } from '$lib/server/band/band-service';
import { db } from '$lib/server/db';
import { reservation } from '$lib/server/db/schema/reservation';
import { user } from '$lib/server/db/schema/auth';
import { eq, and, gt, ne } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) return error(401, 'Not authenticated');

	const band = await getBySlug(params.slug);
	if (!band) return error(404, 'Band not found');

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

	return json({
		upcoming: upcoming.map((r) => ({
			id: r.id,
			status: r.status,
			startsAt: r.startsAt,
			endsAt: r.endsAt,
			notes: r.notes,
			bookedByName: r.bookedByName
		}))
	});
};
