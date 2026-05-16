import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listForUser } from '$lib/server/band/band-service';
import { hasAnyRole } from '$lib/server/authorization';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) return error(401, 'Not authenticated');

	return json({
		user: locals.user,
		userBands: await listForUser(locals.user.id).catch(() => []),
		isStaff: await hasAnyRole(locals.user.id, ['admin', 'staff'])
	});
};
