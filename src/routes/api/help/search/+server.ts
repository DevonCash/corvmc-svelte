import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchArticles } from '$lib/server/help/help-service';
import { getUserRoles } from '$lib/server/authorization';
import { requireFeature } from '$lib/server/feature-flags';

const ROLE_LEVEL: Record<string, number> = { admin: 0, staff: 1, sustaining: 2, member: 3 };

function highestRole(roles: string[]): string {
	let best = 'member';
	for (const r of roles) {
		if ((ROLE_LEVEL[r] ?? 4) < (ROLE_LEVEL[best] ?? 4)) best = r;
	}
	return best;
}

export const GET: RequestHandler = async ({ locals, url }) => {
	await requireFeature('helpArticles');
	if (!locals.user) return error(401, 'Not authenticated');

	const q = url.searchParams.get('q')?.trim();
	if (!q || q.length < 2) return json({ results: [] });

	const roles = await getUserRoles(locals.user.id);
	const userRole = highestRole(roles);

	const results = await searchArticles(q, userRole);
	return json({ results });
};
