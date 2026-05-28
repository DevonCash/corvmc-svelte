import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireStaffRole } from '$lib/server/authorization';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/authentication';
import { or, like } from 'drizzle-orm';
import { SEARCH_LIMIT } from '$lib/config';

export const GET: RequestHandler = async ({ url, locals }) => {
	await requireStaffRole(locals.user?.id);
	const q = url.searchParams.get('q') ?? '';
	if (q.length < 2) return json([]);
	const pattern = `%${q}%`;
	const results = await db
		.select({ id: user.id, name: user.name, email: user.email })
		.from(user)
		.where(or(like(user.name, pattern), like(user.email, pattern)))
		.limit(SEARCH_LIMIT);
	return json(results);
};
