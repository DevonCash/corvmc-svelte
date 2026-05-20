import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { requireStaffRole } from '$lib/server/authorization';
import { unpublish } from '$lib/server/event/event-service';

export const POST: RequestHandler = async ({ params, locals }) => {
	await requireStaffRole(locals.user?.id);
	await unpublish(params.id);
	return json({ success: true });
};
