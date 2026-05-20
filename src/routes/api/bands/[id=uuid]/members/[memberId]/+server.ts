import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireStaffRole } from '$lib/server/authorization';
import { removeMember } from '$lib/server/band/band-service';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	await requireStaffRole(locals.user?.id);
	await removeMember(params.memberId);
	return json({ success: true });
};
