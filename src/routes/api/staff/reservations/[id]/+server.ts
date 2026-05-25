import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasAnyRole } from '$lib/server/authorization';
import { db } from '$lib/server/db';
import { reservation } from '$lib/server/db/schema/reservation';
import { user } from '$lib/server/db/schema/authentication';
import { eq, and, ne, gt, lt, asc, desc, count } from 'drizzle-orm';
import { config } from '$lib/server/site-config/site-config-service';
import { formatDateInTz, buildDateInTz } from '$lib/server/reservation/timezone';
import type { StaffReservationDetailResponse } from '$lib/server/db/schema/api';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) return error(401, 'Not authenticated');
	const allowed = await hasAnyRole(locals.user.id, ['admin', 'staff']);
	if (!allowed) return error(403, 'Staff access required');

	// Load the reservation
	const [row] = await db
		.select({
			id: reservation.id,
			status: reservation.status,
			startsAt: reservation.startsAt,
			endsAt: reservation.endsAt,
			bookerType: reservation.bookerType,
			bookerId: reservation.bookerId,
			notes: reservation.notes,
			cancellationReason: reservation.cancellationReason,
			stripePaymentRecordId: reservation.stripePaymentRecordId,
			createdByUserId: reservation.createdByUserId,
			createdAt: reservation.createdAt,
			memberName: user.name,
			memberEmail: user.email,
			memberPhone: user.phone,
			memberPronouns: user.pronouns,
			memberImage: user.image
		})
		.from(reservation)
		.innerJoin(user, eq(reservation.createdByUserId, user.id))
		.where(eq(reservation.id, params.id))
		.limit(1);

	if (!row) return error(404, 'Reservation not found');

	// Same-day reservations for the timeline bar
	const tz = 'America/Los_Angeles';
	const dayStr = formatDateInTz(row.startsAt, tz);
	const dayStart = buildDateInTz(dayStr, '00:00', tz);
	const dayEnd = buildDateInTz(dayStr, '23:59', tz);

	const sameDayReservations = await db
		.select({
			id: reservation.id,
			bookerType: reservation.bookerType,
			startsAt: reservation.startsAt,
			endsAt: reservation.endsAt,
			status: reservation.status
		})
		.from(reservation)
		.where(
			and(
				ne(reservation.status, 'cancelled'),
				ne(reservation.id, params.id),
				lt(reservation.startsAt, dayEnd),
				gt(reservation.endsAt, dayStart)
			)
		)
		.orderBy(asc(reservation.startsAt));

	// Check if last of the day (no non-cancelled reservations after this one today)
	const laterToday = sameDayReservations.filter(
		(r) => r.startsAt.getTime() > row.startsAt.getTime()
	);
	const isLastOfDay = laterToday.length === 0;

	// Prev/next navigation
	const [prevRow] = await db
		.select({ id: reservation.id })
		.from(reservation)
		.where(and(ne(reservation.status, 'cancelled'), lt(reservation.startsAt, row.startsAt)))
		.orderBy(desc(reservation.startsAt))
		.limit(1);

	const [nextRow] = await db
		.select({ id: reservation.id, startsAt: reservation.startsAt })
		.from(reservation)
		.where(and(ne(reservation.status, 'cancelled'), gt(reservation.startsAt, row.startsAt)))
		.orderBy(asc(reservation.startsAt))
		.limit(1);

	// User's completed reservation count (for "first reservation" badge)
	const [completedCount] = await db
		.select({ count: count() })
		.from(reservation)
		.where(
			and(eq(reservation.createdByUserId, row.createdByUserId), eq(reservation.status, 'completed'))
		);

	return json({
		reservation: {
			id: row.id,
			status: row.status,
			startsAt: row.startsAt,
			endsAt: row.endsAt,
			bookerType: row.bookerType,
			bookerId: row.bookerId,
			notes: row.notes,
			cancellationReason: row.cancellationReason,
			stripePaymentRecordId: row.stripePaymentRecordId,
			createdByUserId: row.createdByUserId,
			createdAt: row.createdAt,
			memberName: row.memberName,
			memberEmail: row.memberEmail,
			memberPhone: row.memberPhone,
			memberPronouns: row.memberPronouns,
			memberImage: row.memberImage
		},
		sameDayReservations: sameDayReservations.map((r) => ({
			id: r.id,
			memberName: '',
			bookerType: r.bookerType,
			startsAt: r.startsAt,
			endsAt: r.endsAt
		})),
		isLastOfDay,
		prevId: prevRow?.id ?? null,
		nextId: nextRow?.id ?? null,
		isFirstReservation: completedCount.count === 0,
		hourlyRateCents: await config<number>('reservation.hourlyRateCents')
	} );
};
