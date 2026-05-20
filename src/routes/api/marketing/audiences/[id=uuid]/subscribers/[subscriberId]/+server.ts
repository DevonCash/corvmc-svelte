import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireStaffRole } from '$lib/server/authorization';
import { removeSubscriber } from '$lib/server/marketing/audience-service';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	await requireStaffRole(locals.user?.id);
	await removeSubscriber(params.id, params.subscriberId);
	return json({ success: true });
};
