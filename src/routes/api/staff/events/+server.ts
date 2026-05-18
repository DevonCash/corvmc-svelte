import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasAnyRole } from '$lib/server/authorization';
import { listAll } from '$lib/server/event/event-service';
import { parsePagination } from '$lib/server/db/paginate';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) return error(401, 'Not authenticated');
	const allowed = await hasAnyRole(locals.user.id, ['admin', 'staff']);
	if (!allowed) return error(403, 'Staff access required');

	const { rows, pagination } = await listAll(parsePagination(url));

	return json({
		events: rows.map((e) => ({
			...e,
			startsAt: e.startsAt.toISOString(),
			endsAt: e.endsAt.toISOString(),
			doorsAt: e.doorsAt?.toISOString() ?? null,
			publishedAt: e.publishedAt?.toISOString() ?? null,
			createdAt: e.createdAt.toISOString(),
			updatedAt: e.updatedAt.toISOString()
		})),
		pagination
	});
};
