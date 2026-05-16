import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listForUser } from '$lib/server/band/band-service';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) return error(401, 'Not authenticated');

	const bands = await listForUser(locals.user.id);

	return json({
		pending: bands.filter((b) => b.status === 'pending'),
		active: bands.filter((b) => b.status === 'active')
	});
};
