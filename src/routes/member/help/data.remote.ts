import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { query, getRequestEvent } from '$app/server';
import {
	listCategories,
	listArticlesByCategory,
	getArticleBySlug,
	searchArticles
} from '$lib/server/help/help-service';
import { getUserRoles } from '$lib/server/authorization';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROLE_LEVEL: Record<string, number> = { admin: 0, staff: 1, sustaining: 2, member: 3 };

function highestRole(roles: string[]): string {
	let best = 'member';
	for (const r of roles) {
		if ((ROLE_LEVEL[r] ?? 4) < (ROLE_LEVEL[best] ?? 4)) best = r;
	}
	return best;
}

async function requireUserWithRole() {
	const { locals } = getRequestEvent();
	if (!locals.user) throw error(401, 'Not authenticated');
	const roles = await getUserRoles(locals.user.id);
	return { user: locals.user, role: highestRole(roles) };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const getCategories = query(z.void(), async () => {
	const { role } = await requireUserWithRole();
	const categories = await listCategories(role);

	const categoriesWithArticles = await Promise.all(
		categories.map(async (cat) => ({
			...cat,
			articles: await listArticlesByCategory(cat.id, role)
		}))
	);

	return categoriesWithArticles;
});

export const getArticle = query(z.string(), async (slug) => {
	const { role } = await requireUserWithRole();
	const article = await getArticleBySlug(slug, role);
	if (!article) throw error(404, 'Article not found');
	return article;
});

export const search = query(z.string(), async (q) => {
	const { role } = await requireUserWithRole();
	if (q.trim().length < 2) return [];
	return searchArticles(q.trim(), role);
});
