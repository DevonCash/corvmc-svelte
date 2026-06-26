import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getArticleBySlug, resolveUserHelpRole } from '$lib/server/help/help-service';
import { requireFeature } from '$lib/server/feature-flags';

export const GET: RequestHandler = async ({ locals, params }) => {
	await requireFeature('helpArticles');
	if (!locals.user) return error(401, 'Not authenticated');

	const userRole = await resolveUserHelpRole(locals.user.id);

	const article = await getArticleBySlug(params.slug, userRole);
	if (!article) return error(404, 'Article not found');

	return json({ article });
};
