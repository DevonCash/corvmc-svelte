import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasAnyRole } from '$lib/server/authorization';
import { listAll } from '$lib/server/event/event-service';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) return error(401, 'Not authenticated');
	const allowed = await hasAnyRole(locals.user.id, ['admin', 'staff']);
	if (!allowed) return error(403, 'Staff access required');

	const events = await listAll();

	return json({
		events: events.map((e) => ({
			...e,
			startsAt: e.startsAt.toISOString(),
			endsAt: e.endsAt.toISOString(),
			doorsAt: e.doorsAt?.toISOString() ?? null,
			publishedAt: e.publishedAt?.toISOString() ?? null,
			createdAt: e.createdAt.toISOString(),
			updatedAt: e.updatedAt.toISOString()
		}))
	});
};
