import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';
import type { SQLiteTable, SQLiteColumn } from 'drizzle-orm/sqlite-core';

/**
 * Generate a URL-friendly slug from a string.
 * Lowercases, replaces non-alphanumeric characters with hyphens,
 * collapses consecutive hyphens, and trims leading/trailing hyphens.
 */
export function generateSlug(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/-{2,}/g, '-')
		.replace(/^-|-$/g, '');
}

/**
 * Ensure a slug is unique within a table by appending -2, -3, etc. if needed.
 *
 * Pass `exclude` when re-slugging an existing row so its own current slug does
 * not count as a collision — without it, every save that touches the name
 * rotates the slug (e.g. 'my-band' → 'my-band-2'), breaking inbound links.
 *
 * Pass `isDisallowed` to block additional slugs (e.g. reserved subdomains) —
 * disallowed values are skipped like collisions.
 */
export async function ensureUniqueSlug(
	baseSlug: string,
	table: SQLiteTable,
	column: SQLiteColumn,
	exclude?: { column: SQLiteColumn; value: string },
	isDisallowed?: (slug: string) => boolean
): Promise<string> {
	let slug = baseSlug;
	let suffix = 2;

	while (true) {
		if (!isDisallowed?.(slug)) {
			const [existing] = await db
				.select({ count: sql<number>`count(*)` })
				.from(table)
				.where(
					exclude
						? sql`${column} = ${slug} and ${exclude.column} != ${exclude.value}`
						: sql`${column} = ${slug}`
				);

			if (!existing || Number(existing.count) === 0) return slug;
		}
		slug = `${baseSlug}-${suffix}`;
		suffix++;
	}
}
