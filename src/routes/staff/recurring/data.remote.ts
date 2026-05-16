import { z } from 'zod';
import { command } from '$app/server';
import { requireStaff } from '$lib/server/authorization';
import { cancel } from '$lib/server/reservation/recurring-series-service';

export const cancelSeries = command(
	z.object({ seriesId: z.string() }),
	async ({ seriesId }) => {
		await requireStaff();
		await cancel(seriesId);
		return { success: true };
	}
);
