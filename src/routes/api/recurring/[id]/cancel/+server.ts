import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { isStaff } from '$lib/server/authorization';
import { cancel, get } from '$lib/server/reservation/recurring-series-service';

export const POST: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Not authenticated');

	const series = await get(params.id);
	if (!series) throw error(404, 'Series not found');

	const staff = await isStaff(locals.user.id);
	if (!staff && series.prototypeCreatedByUserId !== locals.user.id) {
		throw error(403, 'Not authorized');
	}

	await cancel(params.id);
	return json({ success: true });
};
