import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasAnyRole, primaryRoleFor } from '$lib/server/authorization';
import { db } from '$lib/server/db';
import { reservation, reservationStatuses, type ReservationStatus } from '$lib/server/db/schema/reservation';
import { user } from '$lib/server/db/schema/authentication';
import { eq, and, ne, gt, lt, inArray, like, or, desc, asc, count } from 'drizzle-orm';
import { config } from '$lib/server/site-config/site-config-service';
import { paginate, parsePagination } from '$lib/server/db/paginate';
import type { StaffReservationsResponse } from '$lib/server/db/schema/api';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) return error(401, 'Not authenticated');
	const allowed = await hasAnyRole(locals.user.id, ['admin', 'staff']);
	if (!allowed) return error(403, 'Staff access required');

	const now = new Date();
	const tab = url.searchParams.get('tab') ?? 'upcoming';
	const search = url.searchParams.get('q') ?? '';
	const statusFilter = url.searchParams.getAll('status').filter(
		(s): s is ReservationStatus => (reservationStatuses as readonly string[]).includes(s)
	);
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

	if (search) {
		const pattern = `%${search}%`;
		conditions.push(or(like(user.name, pattern), like(user.email, pattern)));
	}

	const where = conditions.length > 0 ? and(...conditions) : undefined;

	const dataQ = db
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
			memberEmail: user.email,
			memberPronouns: user.pronouns,
			memberRole: primaryRoleFor(user.id)
		})
		.from(reservation)
		.innerJoin(user, eq(reservation.createdByUserId, user.id))
		.where(where)
		.orderBy(tab === 'upcoming' ? asc(reservation.startsAt) : desc(reservation.startsAt))
		.$dynamic();

	const countQ = db
		.select({ count: count() })
		.from(reservation)
		.innerJoin(user, eq(reservation.createdByUserId, user.id))
		.where(where);

	const { rows: reservations, pagination } = await paginate(dataQ, countQ, parsePagination(url));

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
			memberEmail: user.email,
			memberPronouns: user.pronouns,
			memberRole: primaryRoleFor(user.id)
		})
		.from(reservation)
		.innerJoin(user, eq(reservation.createdByUserId, user.id))
		.where(
			and(
				eq(reservation.status, 'scheduled'),
				lt(reservation.endsAt, now)
			)
		)
		.orderBy(asc(reservation.endsAt))
		.limit(100);

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
			id: r.id,
			status: r.status,
			startsAt: r.startsAt,
			endsAt: r.endsAt,
			bookerType: r.bookerType,
			notes: r.notes,
			stripePaymentRecordId: r.stripePaymentRecordId,
			createdByUserId: r.createdByUserId,
			recurringSeriesId: r.recurringSeriesId,
			memberName: r.memberName,
			memberEmail: r.memberEmail,
			memberPronouns: r.memberPronouns,
			memberRole: r.memberRole
		})),
		unresolved: unresolved.map((r) => ({
			id: r.id,
			status: r.status,
			startsAt: r.startsAt,
			endsAt: r.endsAt,
			createdByUserId: r.createdByUserId,
			notes: r.notes,
			memberName: r.memberName,
			memberEmail: r.memberEmail,
			memberPronouns: r.memberPronouns,
			memberRole: r.memberRole
		})),
		pagination,
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
		hourlyRateCents: await config<number>('reservation.hourlyRateCents')
	} );
};
