/**
 * Sync static help articles from src/content/help/ into the database.
 *
 * Usage:
 *   pnpm help:sync
 *
 * Reads markdown files with frontmatter, upserts them as help articles
 * with source='static', and removes orphaned static rows.
 */
import 'dotenv/config';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { getPlatformProxy } from 'wrangler';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, notInArray } from 'drizzle-orm';
import { helpCategory, helpArticle } from '../src/lib/server/db/schema/help';

const CONTENT_DIR = join(import.meta.dirname, '../src/content/help');

interface ArticleFrontmatter {
	title: string;
	slug: string;
	category: string;
	summary?: string;
	minRole?: string;
	sortOrder?: number;
}

function parseFrontmatter(content: string): { meta: ArticleFrontmatter; body: string } {
	const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
	if (!match) throw new Error('Missing frontmatter');

	const meta: Record<string, string | number> = {};
	for (const line of match[1].split('\n')) {
		const [key, ...rest] = line.split(':');
		if (key && rest.length) {
			const val = rest.join(':').trim();
			meta[key.trim()] = /^\d+$/.test(val) ? parseInt(val) : val;
		}
	}

	return { meta: meta as unknown as ArticleFrontmatter, body: match[2].trim() };
}

function findMarkdownFiles(dir: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			files.push(...findMarkdownFiles(full));
		} else if (entry.endsWith('.md')) {
			files.push(full);
		}
	}
	return files;
}

async function main() {
	const { env, dispose } = await getPlatformProxy();
	const db = drizzle(env.DB);

	const files = findMarkdownFiles(CONTENT_DIR);
	console.log(`Found ${files.length} markdown file(s) in ${CONTENT_DIR}`);

	// Ensure categories exist
	const categorySlugs = new Set<string>();
	const articles: { meta: ArticleFrontmatter; body: string; file: string }[] = [];

	for (const file of files) {
		const raw = readFileSync(file, 'utf-8');
		const { meta, body } = parseFrontmatter(raw);
		categorySlugs.add(meta.category);
		articles.push({ meta, body, file: relative(CONTENT_DIR, file) });
	}

	// Upsert categories
	const categoryIdMap = new Map<string, string>();
	for (const slug of categorySlugs) {
		const existing = await db
			.select({ id: helpCategory.id })
			.from(helpCategory)
			.where(eq(helpCategory.slug, slug))
			.limit(1);

		if (existing.length > 0) {
			categoryIdMap.set(slug, existing[0].id);
		} else {
			const name = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
			const [cat] = await db
				.insert(helpCategory)
				.values({ name, slug, sortOrder: categoryIdMap.size })
				.returning();
			categoryIdMap.set(slug, cat.id);
			console.log(`  Created category: ${name} (${slug})`);
		}
	}

	// Upsert articles
	const syncedSlugs: string[] = [];
	for (const { meta, body } of articles) {
		const categoryId = categoryIdMap.get(meta.category)!;
		syncedSlugs.push(meta.slug);

		const existing = await db
			.select({ id: helpArticle.id })
			.from(helpArticle)
			.where(and(eq(helpArticle.slug, meta.slug), eq(helpArticle.source, 'static')))
			.limit(1);

		if (existing.length > 0) {
			await db
				.update(helpArticle)
				.set({
					title: meta.title,
					categoryId,
					summary: meta.summary ?? null,
					content: body,
					minRole: meta.minRole ?? 'member',
					sortOrder: meta.sortOrder ?? 0,
					published: true,
					updatedAt: new Date()
				})
				.where(eq(helpArticle.id, existing[0].id));
			console.log(`  Updated: ${meta.title}`);
		} else {
			await db.insert(helpArticle).values({
				categoryId,
				title: meta.title,
				slug: meta.slug,
				summary: meta.summary ?? null,
				content: body,
				source: 'static',
				minRole: meta.minRole ?? 'member',
				published: true,
				sortOrder: meta.sortOrder ?? 0
			});
			console.log(`  Created: ${meta.title}`);
		}
	}

	// Remove orphaned static articles
	if (syncedSlugs.length > 0) {
		await db
			.delete(helpArticle)
			.where(and(eq(helpArticle.source, 'static'), notInArray(helpArticle.slug, syncedSlugs)));
		console.log(`  Cleaned up orphaned static articles`);
	}

	console.log('Done.');
	await dispose();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
