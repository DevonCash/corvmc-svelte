import { redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { reservation } from '$lib/server/db/schema/reservation';
import { eq, and, gt, lte, ne, desc } from 'drizzle-orm';
import { cancel } from '$lib/server/reservation/reservation-service';
import { cancel as cancelSeries, get as getSeries, listForUser } from '$lib/server/reservation/recurring-series-service';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) return redirect(302, '/demo/better-auth/login');

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

	return {
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
	};
};

export const actions: Actions = {
	cancel: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { error: 'Not authenticated' });

		const formData = await request.formData();
		const reservationId = formData.get('reservationId') as string;
		const reason = (formData.get('reason') as string) || undefined;

		if (!reservationId) return fail(400, { error: 'Missing reservation ID' });

		try {
			await cancel(reservationId, locals.user.id, reason);
		} catch (err) {
			return fail(400, { error: (err as Error).message });
		}

		return { success: true };
	},

	cancelSeries: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { error: 'Not authenticated' });

		const formData = await request.formData();
		const seriesId = formData.get('seriesId') as string;

		if (!seriesId) return fail(400, { error: 'Missing series ID' });

		// Verify the caller owns this series
		const series = await getSeries(seriesId);
		if (!series || series.prototypeCreatedByUserId !== locals.user.id) {
			return fail(403, { error: 'Not authorized to cancel this series' });
		}

		try {
			await cancelSeries(seriesId);
		} catch (err) {
			return fail(400, { error: (err as Error).message });
		}

		return { success: true };
	}
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
