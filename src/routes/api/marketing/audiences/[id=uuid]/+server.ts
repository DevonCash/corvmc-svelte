import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireStaffRole } from '$lib/server/authorization';
import { deleteAudience } from '$lib/server/marketing/audience-service';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	await requireStaffRole(locals.user?.id);
	await deleteAudience(params.id);
	return json({ success: true });
};
