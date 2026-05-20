import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireStaffRole } from '$lib/server/authorization';
import { bulkAddMembers } from '$lib/server/marketing/audience-service';

export const POST: RequestHandler = async ({ params, locals }) => {
	await requireStaffRole(locals.user?.id);
	const count = await bulkAddMembers(params.id);
	return json({ added: count });
};
