import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { requireStaffRole } from '$lib/server/authorization';
import { cancel } from '$lib/server/event/event-service';

export const POST: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Not authenticated');
	await requireStaffRole(locals.user.id);
	await cancel(params.id, locals.user.id);
	return json({ success: true });
};
