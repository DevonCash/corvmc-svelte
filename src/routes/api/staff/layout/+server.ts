import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasAnyRole } from '$lib/server/authorization';
import { listForUser } from '$lib/server/band/band-service';
import type { StaffLayoutResponse } from '$lib/server/db/schema/api';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) return error(401, 'Not authenticated');

	const allowed = await hasAnyRole(locals.user.id, ['admin', 'staff']);
	if (!allowed) return error(403, 'Not authorized');

	const user = locals.user;
	const userBands = await listForUser(user.id).catch(() => []);

	return json({
		user: { id: user.id, name: user.name, email: user.email },
		userBands: userBands.map((b) => ({ id: b.id, name: b.name, slug: b.slug }))
	} satisfies StaffLayoutResponse);
};
