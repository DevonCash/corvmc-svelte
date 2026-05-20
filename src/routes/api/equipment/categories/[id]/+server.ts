import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireStaffRole } from '$lib/server/authorization';
import { deleteCategory } from '$lib/server/equipment/equipment-service';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	await requireStaffRole(locals.user?.id);
	await deleteCategory(params.id);
	return json({ success: true });
};
