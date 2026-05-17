import { z } from 'zod';
import { query, command, form } from '$app/server';
import { requireStaff } from '$lib/server/authorization';
import {
	listAllArticles,
	listCategories,
	createArticle,
	updateArticle,
	deleteArticle,
	createCategory,
	updateCategory,
	deleteCategory,
	getArticleById
} from '$lib/server/help/help-service';

function slugify(text: string) {
	return text
		.toLowerCase()
		.replace(/[^\w\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.trim();
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const getArticles = query(z.void(), async () => {
	await requireStaff();
	return listAllArticles();
});

export const getCategories = query(z.void(), async () => {
	await requireStaff();
	return listCategories('admin');
});

export const getArticle = query(z.string(), async (id) => {
	await requireStaff();
	return getArticleById(id);
});

// ---------------------------------------------------------------------------
// Article Commands
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

export const createArticleForm = form(createArticleSchema, async (data) => {
	const staff = await requireStaff();
	const article = await createArticle({
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

export const updateArticleForm = form(updateArticleSchema, async (data) => {
	await requireStaff();
	const { id, ...rest } = data;
	await updateArticle(id, rest);
	return { success: true };
});

export const deleteArticleCommand = command(z.object({ id: z.string().min(1) }), async (data) => {
	await requireStaff();
	await deleteArticle(data.id);
	return { success: true };
});

// ---------------------------------------------------------------------------
// Category Commands
// ---------------------------------------------------------------------------

const createCategorySchema = z.object({
	name: z.string().trim().min(1).max(100),
	slug: z.string().trim().max(100).optional().default(''),
	description: z.string().trim().max(500).optional(),
	icon: z.string().max(50).optional(),
	sortOrder: z.string().optional().default('0').transform((v) => parseInt(v, 10)),
	minRole: z.string().default('member')
});

export const createCategoryForm = form(createCategorySchema, async (data) => {
	await requireStaff();
	const cat = await createCategory({
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
	sortOrder: z.number().int().optional(),
	minRole: z.string().optional()
});

export const updateCategoryCommand = command(updateCategorySchema, async (data) => {
	await requireStaff();
	const { id, ...rest } = data;
	await updateCategory(id, rest);
	return { success: true };
});

export const deleteCategoryCommand = command(z.object({ id: z.string().min(1) }), async (data) => {
	await requireStaff();
	await deleteCategory(data.id);
	return { success: true };
});
