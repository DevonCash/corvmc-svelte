import type { Actions } from './$types';
import { cancel } from '$lib/server/reservation/recurring-series-service';
import { fail } from '@sveltejs/kit';

export const actions: Actions = {
	cancel: async ({ request }) => {
		const formData = await request.formData();
		const seriesId = formData.get('seriesId') as string;

		if (!seriesId) {
			return fail(400, { error: 'Missing series ID' });
		}

		try {
			await cancel(seriesId);
		} catch (err) {
			return fail(400, { error: err instanceof Error ? err.message : 'Failed to cancel series' });
		}

		return { success: true };
	}
};
