import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasAnyRole } from '$lib/server/authorization';
import { db } from '$lib/server/db';
import { reservation } from '$lib/server/db/schema/reservation';
import { user } from '$lib/server/db/schema/auth';
import { eq, and, ne, gt, lt, inArray, like, or, desc, asc, count } from 'drizzle-orm';
import { HOURLY_RATE_CENTS } from '$lib/server/reservation/config';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) return error(401, 'Not authenticated');
	const allowed = await hasAnyRole(locals.user.id, ['admin', 'staff']);
	if (!allowed) return error(403, 'Staff access required');

	const now = new Date();
	const tab = url.searchParams.get('tab') ?? 'upcoming';
	const search = url.searchParams.get('q') ?? '';
	const statusFilter = url.searchParams.getAll('status');
	const dateFrom = url.searchParams.get('from');
	const dateTo = url.searchParams.get('to');

	// Build filters
	const conditions = [];

	if (tab === 'upcoming') {
		conditions.push(gt(reservation.endsAt, now));
		conditions.push(ne(reservation.status, 'cancelled'));
	}

	if (statusFilter.length > 0) {
		conditions.push(inArray(reservation.status, statusFilter));
	}

	if (dateFrom) {
		conditions.push(gt(reservation.startsAt, new Date(dateFrom + 'T00:00:00')));
	}
	if (dateTo) {
		conditions.push(lt(reservation.startsAt, new Date(dateTo + 'T23:59:59')));
	}

	// Search by member name or email in SQL
	if (search) {
		const pattern = `%${search}%`;
		conditions.push(or(like(user.name, pattern), like(user.email, pattern)));
	}

	// Main query
	const reservations = await db
		.select({
			id: reservation.id,
			status: reservation.status,
			startsAt: reservation.startsAt,
			endsAt: reservation.endsAt,
			bookerType: reservation.bookerType,
			notes: reservation.notes,
			stripePaymentRecordId: reservation.stripePaymentRecordId,
			createdByUserId: reservation.createdByUserId,
			recurringSeriesId: reservation.recurringSeriesId,
			memberName: user.name,
			memberEmail: user.email
		})
		.from(reservation)
		.innerJoin(user, eq(reservation.createdByUserId, user.id))
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(tab === 'upcoming' ? asc(reservation.startsAt) : desc(reservation.startsAt))
		.limit(200);

	// Unresolved count + data for resolve modal
	const unresolved = await db
		.select({
			id: reservation.id,
			status: reservation.status,
			startsAt: reservation.startsAt,
			endsAt: reservation.endsAt,
			createdByUserId: reservation.createdByUserId,
			notes: reservation.notes,
			memberName: user.name,
			memberEmail: user.email
		})
		.from(reservation)
		.innerJoin(user, eq(reservation.createdByUserId, user.id))
		.where(
			and(
				eq(reservation.status, 'scheduled'),
				lt(reservation.endsAt, now)
			)
		)
		.orderBy(asc(reservation.endsAt));

	// Tab counts
	const [upcomingCount] = await db
		.select({ count: count() })
		.from(reservation)
		.where(and(gt(reservation.endsAt, now), ne(reservation.status, 'cancelled')));

	const [allCount] = await db
		.select({ count: count() })
		.from(reservation);

	return json({
		reservations: reservations.map((r) => ({
			...r,
			startsAt: r.startsAt.toISOString(),
			endsAt: r.endsAt.toISOString()
		})),
		unresolved: unresolved.map((r) => ({
			...r,
			startsAt: r.startsAt.toISOString(),
			endsAt: r.endsAt.toISOString()
		})),
		tab,
		search,
		statusFilter,
		dateFrom,
		dateTo,
		counts: {
			upcoming: upcomingCount.count,
			all: allCount.count,
			unresolved: unresolved.length
		},
		hourlyRateCents: HOURLY_RATE_CENTS
	});
};
