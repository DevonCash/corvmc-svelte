import { z } from 'zod';
import { command } from '$app/server';
import { requireMember } from '$lib/server/authorization';
import { cancel, confirm, create } from '$lib/server/reservation/reservation-service';
import { cancel as cancelSeriesFn, edit, get as getSeries } from '$lib/server/reservation/recurring-series-service';
import { hasConflict } from '$lib/server/reservation/conflict-service';
import { ReservationConflictError } from '$lib/server/reservation/reservation-service';
import { buildDateInTz } from '$lib/server/reservation/timezone';
import { db } from '$lib/server/db';
import { reservation } from '$lib/server/db/schema/reservation';
import { eq } from 'drizzle-orm';
import type { RecurringFrequency } from '$lib/server/reservation/config';

export const confirmReservation = command(
	z.object({ reservationId: z.string() }),
	async ({ reservationId }) => {
		const user = await requireMember();
		const [row] = await db
			.select({ createdByUserId: reservation.createdByUserId, status: reservation.status })
			.from(reservation)
			.where(eq(reservation.id, reservationId))
			.limit(1);
		if (!row) throw new Error('Reservation not found');
		if (row.createdByUserId !== user.id) throw new Error('Not authorized');
		if (row.status !== 'scheduled') throw new Error('Can only confirm scheduled reservations');
		await confirm(reservationId);
		return { success: true };
	}
);

export const cancelReservation = command(
	z.object({ reservationId: z.string() }),
	async ({ reservationId }) => {
		const user = await requireMember();
		await cancel(reservationId, user.id);
		return { success: true };
	}
);

export const cancelSeries = command(
	z.object({ seriesId: z.string() }),
	async ({ seriesId }) => {
		const user = await requireMember();
		const series = await getSeries(seriesId);
		if (!series || series.prototypeCreatedByUserId !== user.id) {
			throw new Error('Not authorized to cancel this series');
		}
		await cancelSeriesFn(seriesId);
		return { success: true };
	}
);

export const editSeries = command(
	z.object({
		seriesId: z.string(),
		date: z.string(),
		startTime: z.string(),
		endTime: z.string(),
		frequency: z.enum(['weekly', 'biweekly', 'monthly'])
	}),
	async (data) => {
		const user = await requireMember();
		const series = await getSeries(data.seriesId);
		if (!series || series.prototypeCreatedByUserId !== user.id) {
			throw new Error('Not authorized to edit this series');
		}

		const tz = 'America/Los_Angeles';
		const startsAt = buildDateInTz(data.date, data.startTime, tz);
		const endsAt = buildDateInTz(data.date, data.endTime, tz);

		const conflict = await hasConflict(startsAt, endsAt);
		if (conflict) throw new ReservationConflictError();

		const newPrototype = await create({
			userId: user.id,
			bookerType: series.prototypeBookerType as 'user' | 'band' | 'event' | 'lesson',
			bookerId: series.prototypeBookerId,
			startsAt,
			endsAt
		});

		await edit({
			oldSeriesId: data.seriesId,
			newPrototypeReservationId: newPrototype.id,
			frequency: data.frequency as RecurringFrequency,
			prototypeStartsAt: startsAt
		});

		return { success: true };
	}
);
