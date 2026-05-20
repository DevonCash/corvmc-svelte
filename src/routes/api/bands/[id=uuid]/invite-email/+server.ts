import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireStaffRole } from '$lib/server/authorization';
import { createInvite } from '$lib/server/band/platform-invite-service';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	await requireStaffRole(locals.user?.id);
	const { email, role, position } = (await request.json()) as { email?: string; role?: 'admin' | 'member'; position?: string };
	if (!email || !role) return json({ error: 'Email and role required' }, { status: 400 });
	const result = await createInvite(email, params.id, role, position ?? null, locals.user!.id);
	return json({ success: true, ...result });
};
