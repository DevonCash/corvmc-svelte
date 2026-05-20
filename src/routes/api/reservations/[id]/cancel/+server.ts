import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { isStaff } from '$lib/server/authorization';
import { cancel } from '$lib/server/reservation/reservation-service';

export const POST: RequestHandler = async ({ params, locals, request }) => {
	if (!locals.user) throw error(401, 'Not authenticated');

	const body = await request.json().catch(() => ({}));
	const reason = (body as { reason?: string }).reason;
	const staff = await isStaff(locals.user.id);

	await cancel(params.id, locals.user.id, reason, { staffOverride: staff });
	return json({ success: true });
};
