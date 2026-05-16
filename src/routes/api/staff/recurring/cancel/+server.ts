import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { cancel } from '$lib/server/reservation/recurring-series-service';
import { hasAnyRole } from '$lib/server/authorization';

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) return json({ error: 'Not authenticated' }, { status: 401 });

	const isStaff = await hasAnyRole(locals.user.id, ['admin', 'staff']);
	if (!isStaff) return json({ error: 'Forbidden' }, { status: 403 });

	const formData = await request.formData();
	const seriesId = formData.get('seriesId') as string;

	if (!seriesId) {
		return json({ error: 'Missing series ID' }, { status: 400 });
	}

	try {
		await cancel(seriesId);
		return json({ success: true });
	} catch (err) {
		return json({ error: err instanceof Error ? err.message : 'Failed to cancel series' }, { status: 400 });
	}
};
