import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasAnyRole } from '$lib/server/authorization';
import { listForUser } from '$lib/server/band/band-service';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) return error(401, 'Not authenticated');

	const allowed = await hasAnyRole(locals.user.id, ['admin', 'staff']);
	if (!allowed) return error(403, 'Not authorized');

	return json({
		user: locals.user,
		userBands: await listForUser(locals.user.id).catch(() => [])
	});
};
