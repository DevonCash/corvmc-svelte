import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { cancel as cancelSeries, get as getSeries } from '$lib/server/reservation/recurring-series-service';

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) return json({ error: 'Not authenticated' }, { status: 401 });

	const formData = await request.formData();
	const seriesId = formData.get('seriesId') as string;

	if (!seriesId) return json({ error: 'Missing series ID' }, { status: 400 });

	// Verify the caller owns this series
	const series = await getSeries(seriesId);
	if (!series || series.prototypeCreatedByUserId !== locals.user.id) {
		return json({ error: 'Not authorized to cancel this series' }, { status: 403 });
	}

	try {
		await cancelSeries(seriesId);
		return json({ success: true });
	} catch (err) {
		return json({ error: (err as Error).message }, { status: 400 });
	}
};
