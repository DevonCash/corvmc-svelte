import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { reservation } from '$lib/server/db/schema/reservation';
import { paymentCache, creditTransaction } from '$lib/server/db/schema/finance';
import { eq, and, gt, lte, ne, desc, inArray } from 'drizzle-orm';
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

	const allIds = [...upcoming, ...past].map((r) => r.id);

	const [payments, credits] = allIds.length > 0
		? await Promise.all([
				db
					.select({
						reservationId: paymentCache.reservationId,
						paidAt: paymentCache.paidAt,
						amountCents: paymentCache.amountCents
					})
					.from(paymentCache)
					.where(inArray(paymentCache.reservationId, allIds)),
				db
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
			])
		: [[], []];

	const paymentsByRes = new Map(payments.filter((p) => p.reservationId != null).map((p) => [p.reservationId!, p]));
	const creditsByRes = new Map(credits.filter((c) => c.sourceId != null).map((c) => [c.sourceId!, c]));

	return json({
		upcoming: upcoming.map((r) => serializeReservation(r, paymentsByRes, creditsByRes)),
		past: past.map((r) => serializeReservation(r, paymentsByRes, creditsByRes)),
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

function serializeReservation(row: any, payments: Map<string, any>, credits: Map<string, any>) {
	const payment = payments.get(row.id);
	const credit = credits.get(row.id);
	return {
		id: row.id,
		bookerType: row.bookerType,
		bookerId: row.bookerId,
		status: row.status,
		startsAt: row.startsAt.toISOString(),
		endsAt: row.endsAt.toISOString(),
		notes: row.notes,
		recurringSeriesId: row.recurringSeriesId ?? null,
		paidAt: payment?.paidAt?.toISOString() ?? null,
		paidAmountCents: payment?.amountCents ?? null,
		paidWithCredits: credit != null
	};
}
