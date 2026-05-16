import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { cancel } from '$lib/server/reservation/reservation-service';
import { cancel as cancelSeries, get as getSeries } from '$lib/server/reservation/recurring-series-service';

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
