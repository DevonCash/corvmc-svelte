import { redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { reservation } from '$lib/server/db/schema/reservation';
import { eq, and, gt, lte, ne, desc } from 'drizzle-orm';
import { cancel } from '$lib/server/reservation/reservation-service';
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

	return {
		upcoming: upcoming.map(serializeReservation),
		past: past.map(serializeReservation)
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
		notes: row.notes
	};
}
