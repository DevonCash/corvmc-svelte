import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';
import type { PgTable, PgColumn } from 'drizzle-orm/pg-core';

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
 */
export async function ensureUniqueSlug(
	baseSlug: string,
	table: PgTable,
	column: PgColumn
): Promise<string> {
	let slug = baseSlug;
	let suffix = 2;

	while (true) {
		const [existing] = await db
			.select({ count: sql<number>`count(*)` })
			.from(table)
			.where(sql`${column} = ${slug}`);

		if (!existing || Number(existing.count) === 0) return slug;
		slug = `${baseSlug}-${suffix}`;
		suffix++;
	}
}
