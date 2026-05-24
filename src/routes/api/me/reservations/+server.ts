import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { reservation } from '$lib/server/db/schema/reservation';
import { creditTransaction } from '$lib/server/db/schema/finance';
import { eq, and, gt, lte, ne, desc, inArray } from 'drizzle-orm';
import { listForUser } from '$lib/server/reservation/recurring-series-service';
import { toISO, type ISODateString } from '$lib/server/db/schema/columns';
import type { MemberReservationsResponse, MemberReservation } from '$lib/server/db/schema/api';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) return error(401, 'Not authenticated');

	const now = new Date();

	const upcoming = await db
		.select()
		.from(reservation)
		.where(
			and(
				eq(reservation.createdByUserId, locals.user.id),
				gt(reservation.endsAt, now),
				inArray(reservation.status, ["scheduled", "confirmed", "waitlisted"])
			)
		)
		.orderBy(reservation.startsAt);

	const all = await db
		.select()
		.from(reservation)
		.where(eq(reservation.createdByUserId, locals.user.id))
		.orderBy(desc(reservation.startsAt));

	const recurringSeries = await listForUser(locals.user.id);

	const allIds = [...upcoming, ...all].map((r) => r.id);

	const credits = allIds.length > 0
		? await db
				.select({
					sourceId: creditTransaction.sourceId,
					amount: creditTransaction.amount,
					createdAt: creditTransaction.createdAt
				})
				.from(creditTransaction)
				.where(
					and(
						eq(creditTransaction.source, 'reservation'),
						inArray(creditTransaction.sourceId, allIds)
					)
				)
		: [];

	const creditsByRes = new Map(credits.filter((c) => c.sourceId != null).map((c) => [c.sourceId!, c]));

	return json({
		upcoming: upcoming.map((r) => serializeReservation(r, creditsByRes)),
		all: all.map((r) => serializeReservation(r, creditsByRes)),
		recurringSeries: recurringSeries.map((s) => ({
			id: s.id,
			frequencyLabel: s.frequencyLabel,
			bookerType: s.bookerType,
			startsAt: toISO(s.startsAt),
			endsAt: toISO(s.endsAt),
			createdAt: toISO(s.createdAt),
			seriesEndsAt: s.seriesEndsAt ? toISO(s.seriesEndsAt) : null
		}))
	} satisfies MemberReservationsResponse);
};

function toISOOrNull(d: Date | null | undefined): ISODateString | null {
	return d && !isNaN(d.getTime()) ? toISO(d) : null;
}

function serializeReservation(row: any, credits: Map<string, any>): MemberReservation {
	const credit = credits.get(row.id);
	return {
		id: row.id,
		bookerType: row.bookerType,
		bookerId: row.bookerId,
		status: row.status,
		startsAt: toISO(row.startsAt),
		endsAt: toISO(row.endsAt),
		notes: row.notes,
		recurringSeriesId: row.recurringSeriesId ?? null,
		paidAt: toISOOrNull(row.paidAt),
		refundedAt: toISOOrNull(row.refundedAt),
		paidWithCredits: credit != null,
		waitlistNotifiedAt: toISOOrNull(row.waitlistNotifiedAt),
		waitlistExpiresAt: toISOOrNull(row.waitlistExpiresAt)
	};
}
