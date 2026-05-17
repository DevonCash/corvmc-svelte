import { z } from 'zod';
import { query, command, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { requireStaff } from '$lib/server/authorization';
import {
	get,
	getHistory,
	edit,
	cancel
} from '$lib/server/reservation/recurring-series-service';
import { staffCreate } from '$lib/server/reservation/reservation-service';
import { hasConflict } from '$lib/server/reservation/conflict-service';
import { ReservationConflictError } from '$lib/server/reservation/reservation-service';
import { buildDateInTz } from '$lib/server/reservation/timezone';

export const getSeries = query(z.string(), async (id) => {
	await requireStaff();
	const series = await get(id);
	if (!series) error(404, 'Series not found');
	return series;
});

export const getSeriesHistory = query(z.string(), async (id) => {
	await requireStaff();
	return getHistory(id);
});

export const cancelSeries = command(z.object({}), async () => {
	await requireStaff();
	const { params } = getRequestEvent();
	await cancel(params.id!);
	void getSeries(params.id!).refresh();
	return { success: true };
});

export const editSeries = command(
	z.object({
		date: z.string(),
		startTime: z.string(),
		endTime: z.string(),
		frequency: z.enum(['weekly', 'biweekly', 'monthly']),
		overrideConflicts: z.boolean().default(false)
	}),
	async (data) => {
		const staff = await requireStaff();
		const { params } = getRequestEvent();
		const seriesId = params.id!;
		const tz = 'America/Los_Angeles';

		const startsAt = buildDateInTz(data.date, data.startTime, tz);
		const endsAt = buildDateInTz(data.date, data.endTime, tz);

		if (!data.overrideConflicts) {
			const conflict = await hasConflict(startsAt, endsAt);
			if (conflict) {
				throw new ReservationConflictError();
			}
		}

		const series = await get(seriesId);
		if (!series) throw new Error('Series not found');

		const newPrototype = await staffCreate({
			userId: series.prototypeCreatedByUserId,
			bookerType: series.prototypeBookerType as 'user' | 'band' | 'event' | 'lesson',
			bookerId: series.prototypeBookerId,
			startsAt,
			endsAt,
			status: 'scheduled'
		});

		await edit({
			oldSeriesId: seriesId,
			newPrototypeReservationId: newPrototype.id,
			frequency: data.frequency,
			prototypeStartsAt: startsAt
		});

		return { success: true };
	}
);
