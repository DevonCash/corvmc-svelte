import { z } from 'zod';
import { command } from '$app/server';
import { requireMember } from '$lib/server/authorization';
import { create } from '$lib/server/reservation/reservation-service';
import { edit, get as getSeries } from '$lib/server/reservation/recurring-series-service';
import { hasConflict } from '$lib/server/reservation/conflict-service';
import { ReservationConflictError } from '$lib/server/reservation/reservation-service';
import { buildDateInTz } from '$lib/server/reservation/timezone';
import type { RecurringFrequency } from '$lib/server/db/schema/recurring';

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
