import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireStaffRole } from '$lib/server/authorization';
import { searchMembers } from '$lib/server/band/band-service';

export const GET: RequestHandler = async ({ params, url, locals }) => {
	await requireStaffRole(locals.user?.id);
	const q = url.searchParams.get('q') ?? '';
	if (q.length < 2) return json([]);
	const results = await searchMembers(q, params.id);
	return json(results);
};
