import { db } from '$lib/server/db';
import { helpCategory, helpArticle } from '$lib/server/db/schema/help';
import { eq, and, like, or, sql, inArray, asc } from 'drizzle-orm';
import { SEARCH_LIMIT } from '$lib/config';

const ROLE_LEVEL: Record<string, number> = { admin: 0, staff: 1, sustaining: 2, member: 3 };

function accessibleRoles(userRole: string): string[] {
	const level = ROLE_LEVEL[userRole] ?? 3;
	return Object.entries(ROLE_LEVEL)
		.filter(([, l]) => l >= level)
		.map(([r]) => r);
}

// ---------------------------------------------------------------------------
// Category Queries
// ---------------------------------------------------------------------------

export async function listCategories(userRole: string) {
	const roles = accessibleRoles(userRole);
	return db
		.select()
		.from(helpCategory)
		.where(inArray(helpCategory.minRole, roles))
		.orderBy(asc(helpCategory.sortOrder), asc(helpCategory.name));
}

export async function getCategoryBySlug(slug: string) {
	const [cat] = await db.select().from(helpCategory).where(eq(helpCategory.slug, slug)).limit(1);
	return cat ?? null;
}

// ---------------------------------------------------------------------------
// Article Queries
// ---------------------------------------------------------------------------

export async function listArticlesByCategory(categoryId: string, userRole: string) {
	const roles = accessibleRoles(userRole);
	return db
		.select({
			id: helpArticle.id,
			title: helpArticle.title,
			slug: helpArticle.slug,
			summary: helpArticle.summary,
			sortOrder: helpArticle.sortOrder
		})
		.from(helpArticle)
		.where(
			and(
				eq(helpArticle.categoryId, categoryId),
				eq(helpArticle.published, true),
				inArray(helpArticle.minRole, roles)
			)
		)
		.orderBy(asc(helpArticle.sortOrder), asc(helpArticle.title));
}

export async function getArticleBySlug(slug: string, userRole: string) {
	const roles = accessibleRoles(userRole);
	const [article] = await db
		.select()
		.from(helpArticle)
		.where(
			and(
				eq(helpArticle.slug, slug),
				eq(helpArticle.published, true),
				inArray(helpArticle.minRole, roles)
			)
		)
		.limit(1);
	return article ?? null;
}

export async function searchArticles(query: string, userRole: string) {
	const roles = accessibleRoles(userRole);
	const pattern = `%${query}%`;
	return db
		.select({
			id: helpArticle.id,
			title: helpArticle.title,
			slug: helpArticle.slug,
			summary: helpArticle.summary,
			categoryId: helpArticle.categoryId
		})
		.from(helpArticle)
		.where(
			and(
				eq(helpArticle.published, true),
				inArray(helpArticle.minRole, roles),
				or(
					like(helpArticle.title, pattern),
					like(helpArticle.summary, pattern),
					like(helpArticle.content, pattern)
				)
			)
		)
		.orderBy(
			sql`case when ${helpArticle.title} like ${pattern} then 0 else 1 end`,
			asc(helpArticle.title)
		)
		.limit(SEARCH_LIMIT);
}

// ---------------------------------------------------------------------------
// Staff: list all articles (including unpublished)
// ---------------------------------------------------------------------------

export async function listAllArticles() {
	return db
		.select({
			id: helpArticle.id,
			title: helpArticle.title,
			slug: helpArticle.slug,
			summary: helpArticle.summary,
			categoryId: helpArticle.categoryId,
			source: helpArticle.source,
			minRole: helpArticle.minRole,
			published: helpArticle.published,
			sortOrder: helpArticle.sortOrder,
			createdAt: helpArticle.createdAt,
			updatedAt: helpArticle.updatedAt
		})
		.from(helpArticle)
		.orderBy(asc(helpArticle.sortOrder), asc(helpArticle.title));
}

export async function getArticleById(id: string) {
	const [article] = await db.select().from(helpArticle).where(eq(helpArticle.id, id)).limit(1);
	return article ?? null;
}

// ---------------------------------------------------------------------------
// Category Mutations
// ---------------------------------------------------------------------------

export interface CreateCategoryData {
	name: string;
	slug: string;
	description?: string;
	icon?: string;
	sortOrder?: number;
	minRole?: string;
}

export async function createCategory(data: CreateCategoryData) {
	const [cat] = await db
		.insert(helpCategory)
		.values({
			name: data.name,
			slug: data.slug,
			description: data.description ?? null,
			icon: data.icon ?? null,
			sortOrder: data.sortOrder ?? 0,
			minRole: data.minRole ?? 'member'
		})
		.returning();
	return cat;
}

export async function updateCategory(id: string, data: Partial<CreateCategoryData>) {
	const [cat] = await db
		.update(helpCategory)
		.set({
			...data,
			updatedAt: new Date()
		})
		.where(eq(helpCategory.id, id))
		.returning();
	return cat;
}

export async function deleteCategory(id: string) {
	await db.delete(helpCategory).where(eq(helpCategory.id, id));
}

// ---------------------------------------------------------------------------
// Article Mutations
// ---------------------------------------------------------------------------

export interface CreateArticleData {
	categoryId: string;
	title: string;
	slug: string;
	summary?: string;
	content: string;
	source?: string;
	minRole?: string;
	published?: boolean;
	sortOrder?: number;
	createdByUserId?: string;
}

export async function createArticle(data: CreateArticleData) {
	const [article] = await db
		.insert(helpArticle)
		.values({
			categoryId: data.categoryId,
			title: data.title,
			slug: data.slug,
			summary: data.summary ?? null,
			content: data.content,
			source: data.source ?? 'dynamic',
			minRole: data.minRole ?? 'member',
			published: data.published ?? false,
			sortOrder: data.sortOrder ?? 0,
			createdByUserId: data.createdByUserId ?? null
		})
		.returning();
	return article;
}

export async function updateArticle(id: string, data: Partial<CreateArticleData>) {
	const [article] = await db
		.update(helpArticle)
		.set({
			...data,
			updatedAt: new Date()
		})
		.where(eq(helpArticle.id, id))
		.returning();
	return article;
}

export async function deleteArticle(id: string) {
	await db.delete(helpArticle).where(eq(helpArticle.id, id));
}
