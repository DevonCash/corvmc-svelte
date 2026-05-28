import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listCategories, listArticlesByCategory } from '$lib/server/help/help-service';
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

export const GET: RequestHandler = async ({ locals }) => {
	await requireFeature('helpArticles');
	if (!locals.user) return error(401, 'Not authenticated');

	const roles = await getUserRoles(locals.user.id);
	const userRole = highestRole(roles);

	const categories = await listCategories(userRole);

	const categoriesWithArticles = await Promise.all(
		categories.map(async (cat) => ({
			...cat,
			articles: await listArticlesByCategory(cat.id, userRole)
		}))
	);

	return json({ categories: categoriesWithArticles });
};
