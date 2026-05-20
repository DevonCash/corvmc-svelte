import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { requireStaffRole } from '$lib/server/authorization';
import { addSubscriber } from '$lib/server/marketing/audience-service';
import { findOrCreateByEmail } from '$lib/server/marketing/subscriber-service';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	await requireStaffRole(locals.user?.id);

	const body = (await request.json()) as { email?: string; name?: string };
	if (!body.email) throw error(400, 'Email is required');

	const sub = await findOrCreateByEmail(body.email, body.name);
	await addSubscriber(params.id, sub.id);
	return json({ success: true });
};
