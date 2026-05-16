import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { reservation } from '$lib/server/db/schema/reservation';
import { eq, and, gt, lte, ne, desc } from 'drizzle-orm';
import { listForUser } from '$lib/server/reservation/recurring-series-service';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) return error(401, 'Not authenticated');

	const now = new Date();

	const upcoming = await db
		.select()
		.from(reservation)
		.where(
			and(
				eq(reservation.createdByUserId, locals.user.id),
				gt(reservation.startsAt, now),
				ne(reservation.status, 'cancelled')
			)
		)
		.orderBy(reservation.startsAt);

	const past = await db
		.select()
		.from(reservation)
		.where(
			and(
				eq(reservation.createdByUserId, locals.user.id),
				lte(reservation.startsAt, now)
			)
		)
		.orderBy(desc(reservation.startsAt))
		.limit(20);

	const recurringSeries = await listForUser(locals.user.id);

	return json({
		upcoming: upcoming.map(serializeReservation),
		past: past.map(serializeReservation),
		recurringSeries: recurringSeries.map((s) => ({
			id: s.id,
			frequencyLabel: s.frequencyLabel,
			bookerType: s.bookerType,
			startsAt: s.startsAt.toISOString(),
			endsAt: s.endsAt.toISOString(),
			createdAt: s.createdAt.toISOString()
		}))
	});
};

function serializeReservation(row: any) {
	return {
		id: row.id,
		bookerType: row.bookerType,
		bookerId: row.bookerId,
		status: row.status,
		startsAt: row.startsAt.toISOString(),
		endsAt: row.endsAt.toISOString(),
		notes: row.notes,
		recurringSeriesId: row.recurringSeriesId ?? null
	};
}
