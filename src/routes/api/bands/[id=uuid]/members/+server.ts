import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireStaffRole } from '$lib/server/authorization';
import { invite } from '$lib/server/band/band-service';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	await requireStaffRole(locals.user?.id);
	const { userId, role, position } = (await request.json()) as { userId?: string; role?: 'admin' | 'member'; position?: string };
	if (!userId || !role) return json({ error: 'userId and role required' }, { status: 400 });
	await invite(params.id, userId, role, position ?? null, locals.user!.id);
	return json({ success: true });
};
