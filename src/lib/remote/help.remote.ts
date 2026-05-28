import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { query, form, getRequestEvent } from '$app/server';
import { requireStaff, getUserRoles } from '$lib/server/authorization';
import { requireFeature } from '$lib/server/feature-flags';
import {
	listCategories,
	listArticlesByCategory,
	getArticleBySlug,
	searchArticles,
	listAllArticles,
	createArticle as createArticleSvc,
	updateArticle as updateArticleSvc,
	deleteArticle as deleteArticleSvc,
	createCategory as createCategorySvc,
	updateCategory as updateCategorySvc,
	deleteCategory as deleteCategorySvc,
	getArticleById
} from '$lib/server/help/help-service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(text: string) {
	return text
		.toLowerCase()
		.replace(/[^\w\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.trim();
}

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
// Member Queries
// ---------------------------------------------------------------------------

export const getMemberCategories = query(z.void(), async () => {
	await requireFeature('helpArticles');
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

export const getMemberArticle = query(z.string(), async (slug) => {
	await requireFeature('helpArticles');
	const { role } = await requireUserWithRole();
	const article = await getArticleBySlug(slug, role);
	if (!article) throw error(404, 'Article not found');
	return article;
});

export const searchHelp = query(z.string(), async (q) => {
	const { role } = await requireUserWithRole();
	if (q.trim().length < 2) return [];
	return searchArticles(q.trim(), role);
});

// ---------------------------------------------------------------------------
// Staff Queries
// ---------------------------------------------------------------------------

export const getStaffArticles = query(z.void(), async () => {
	await requireFeature('helpArticles');
	await requireStaff();
	return listAllArticles();
});

export const getStaffCategories = query(z.void(), async () => {
	await requireStaff();
	return listCategories('admin');
});

export const getStaffArticle = query(z.string(), async (id) => {
	await requireStaff();
	return getArticleById(id);
});

// ---------------------------------------------------------------------------
// Article Forms
// ---------------------------------------------------------------------------

const createArticleSchema = z.object({
	categoryId: z.string().min(1),
	title: z.string().trim().min(1).max(255),
	slug: z.string().trim().max(255).optional().default(''),
	summary: z.string().trim().max(500).optional(),
	content: z.string().min(1),
	minRole: z.string().default('member'),
	published: z.string().optional().transform((v) => v === 'on')
});

export const createArticle = form(createArticleSchema, async (data) => {
	const staff = await requireStaff();
	const article = await createArticleSvc({
		...data,
		slug: data.slug || slugify(data.title),
		createdByUserId: staff.id
	});
	return { id: article.id };
});

const updateArticleSchema = z.object({
	id: z.string().min(1),
	categoryId: z.string().min(1),
	title: z.string().trim().min(1).max(255),
	slug: z.string().trim().min(1).max(255),
	summary: z.string().trim().max(500).optional(),
	content: z.string().min(1),
	minRole: z.string(),
	published: z.string().optional().transform((v) => v === 'on')
});

export const updateArticle = form(updateArticleSchema, async (data) => {
	await requireStaff();
	const { id, ...rest } = data;
	await updateArticleSvc(id, rest);
	return { success: true };
});

export const deleteArticle = form(
	z.object({ id: z.string().min(1) }),
	async (data) => {
		await requireStaff();
		await deleteArticleSvc(data.id);
		return { success: true };
	}
);

// ---------------------------------------------------------------------------
// Category Forms
// ---------------------------------------------------------------------------

const createCategorySchema = z.object({
	name: z.string().trim().min(1).max(100),
	slug: z.string().trim().max(100).optional().default(''),
	description: z.string().trim().max(500).optional(),
	icon: z.string().max(50).optional(),
	sortOrder: z.string().optional().default('0').transform((v) => parseInt(v, 10)),
	minRole: z.string().default('member')
});

export const createCategory = form(createCategorySchema, async (data) => {
	await requireStaff();
	const cat = await createCategorySvc({
		...data,
		slug: data.slug || slugify(data.name)
	});
	return { id: cat.id };
});

const updateCategorySchema = z.object({
	id: z.string().min(1),
	name: z.string().trim().min(1).max(100).optional(),
	slug: z.string().trim().min(1).max(100).optional(),
	description: z.string().trim().max(500).optional(),
	icon: z.string().max(50).optional(),
	sortOrder: z.string().optional().transform((v) => (v != null ? parseInt(v, 10) : undefined)),
	minRole: z.string().optional()
});

export const updateCategory = form(updateCategorySchema, async (data) => {
	await requireStaff();
	const { id, ...rest } = data;
	await updateCategorySvc(id, rest);
	return { success: true };
});

export const deleteCategory = form(
	z.object({ id: z.string().min(1) }),
	async (data) => {
		await requireStaff();
		await deleteCategorySvc(data.id);
		return { success: true };
	}
);
