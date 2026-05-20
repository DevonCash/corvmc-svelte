import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireStaffRole } from '$lib/server/authorization';
import { softDeleteEquipment } from '$lib/server/equipment/equipment-service';

export const POST: RequestHandler = async ({ params, locals }) => {
	await requireStaffRole(locals.user?.id);
	await softDeleteEquipment(params.id);
	return json({ success: true });
};
