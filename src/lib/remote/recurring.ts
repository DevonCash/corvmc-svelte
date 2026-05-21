import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { query, form, getRequestEvent } from '$app/server';
import { requireStaff, requireMember, isStaff } from '$lib/server/authorization';
import {
	get,
	getHistory,
	edit,
	cancel
} from '$lib/server/reservation/recurring-series-service';
import { staffCreate, create } from '$lib/server/reservation/reservation-service';
import { ReservationConflictError } from '$lib/server/reservation/reservation-service';
import { hasConflict } from '$lib/server/reservation/conflict-service';
import { buildDateInTz } from '$lib/server/reservation/timezone';
import type { RecurringFrequency } from '$lib/server/db/schema/recurring';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

/** Cancel from staff list page (takes seriesId in form data) */
export const cancelStaffSeries = form(
	z.object({ seriesId: z.string() }),
	async (data) => {
		await requireStaff();
		await cancel(data.seriesId as string);
		return { success: true };
	}
);

/** Edit series from detail page */
export const editStaffSeries = form(
	z.object({
		seriesId: z.string(),
		date: z.string(),
		startTime: z.string(),
		endTime: z.string(),
		frequency: z.string(),
		overrideConflicts: z.literal('on').optional()
	}),
	async (data) => {
		await requireStaff();
		const seriesId = data.seriesId as string;
		const frequency = data.frequency as 'weekly' | 'biweekly' | 'monthly';
		const tz = 'America/Los_Angeles';

		const startsAt = buildDateInTz(data.date as string, data.startTime as string, tz);
		const endsAt = buildDateInTz(data.date as string, data.endTime as string, tz);

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
			frequency,
			prototypeStartsAt: startsAt
		});

		void getSeries(seriesId).refresh();
		return { success: true };
	}
);

/** Cancel from detail page (takes seriesId in form data) */
export const cancelDetailSeries = form(
	z.object({ seriesId: z.string() }),
	async (data) => {
		await requireStaff();
		const seriesId = data.seriesId as string;
		await cancel(seriesId);
		void getSeries(seriesId).refresh();
		return { success: true };
	}
);

/** Edit series from member page (owner only) */
export const editMemberSeries = form(
	z.object({
		seriesId: z.string(),
		date: z.string(),
		startTime: z.string(),
		endTime: z.string(),
		frequency: z.string()
	}),
	async (data) => {
		const user = await requireMember();
		const seriesId = data.seriesId as string;
		const series = await get(seriesId);
		if (!series || series.prototypeCreatedByUserId !== user.id) {
			throw new Error('Not authorized to edit this series');
		}

		const tz = 'America/Los_Angeles';
		const startsAt = buildDateInTz(data.date as string, data.startTime as string, tz);
		const endsAt = buildDateInTz(data.date as string, data.endTime as string, tz);

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
			oldSeriesId: seriesId,
			newPrototypeReservationId: newPrototype.id,
			frequency: data.frequency as RecurringFrequency,
			prototypeStartsAt: startsAt
		});

		return { success: true };
	}
);

/** Cancel from member page / CancelSeriesAction (owner or staff) */
export const cancelRecurringSeries = form(
	z.object({ id: z.string() }),
	async (data) => {
		const { locals } = getRequestEvent();
		if (!locals.user) throw error(401, 'Not authenticated');

		const id = data.id as string;
		const series = await get(id);
		if (!series) throw error(404, 'Series not found');

		const staff = await isStaff(locals.user.id);
		if (!staff && series.prototypeCreatedByUserId !== locals.user.id) {
			throw error(403, 'Not authorized');
		}

		await cancel(id);
		return { success: true };
	}
);
