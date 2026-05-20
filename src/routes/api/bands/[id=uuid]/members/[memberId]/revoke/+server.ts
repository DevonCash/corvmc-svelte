import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireStaffRole } from '$lib/server/authorization';
import { revokeInvitation } from '$lib/server/band/band-service';

export const POST: RequestHandler = async ({ params, locals }) => {
	await requireStaffRole(locals.user?.id);
	await revokeInvitation(params.memberId);
	return json({ success: true });
};
