import { z } from 'zod';
import { command } from '$app/server';
import { requireMember } from '$lib/server/authorization';
import { cancel } from '$lib/server/reservation/reservation-service';
import { cancel as cancelSeriesFn, get as getSeries } from '$lib/server/reservation/recurring-series-service';

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
