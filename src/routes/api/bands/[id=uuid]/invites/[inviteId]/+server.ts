import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireStaffRole } from '$lib/server/authorization';
import { revoke } from '$lib/server/band/platform-invite-service';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	await requireStaffRole(locals.user?.id);
	await revoke(params.inviteId);
	return json({ success: true });
};
