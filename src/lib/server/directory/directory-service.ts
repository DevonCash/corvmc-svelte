import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/auth';
import { band, bandMember } from '$lib/server/db/schema/band';
import { isNull, eq, asc, sql, and, ilike, inArray } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MemberFilters = {
	search?: string;
	instruments?: string[];
	genres?: string[];
	lookingForBand?: boolean;
};

export type BandFilters = {
	search?: string;
	genres?: string[];
	lookingForMembers?: boolean;
};

// ---------------------------------------------------------------------------
// Member queries
// ---------------------------------------------------------------------------

const memberSelect = {
	id: user.id,
	name: user.name,
	pronouns: user.pronouns,
	image: user.image,
	bio: user.bio,
	tagline: user.tagline,
	instruments: user.instruments,
	genres: user.genres,
	lookingForBand: user.lookingForBand,
	directoryContact: user.directoryContact,
	links: user.links
} as const;

function memberWhereConditions(
	visibility: 'members' | 'public',
	filters?: MemberFilters
): SQL[] {
	const conditions: SQL[] = [isNull(user.deletedAt)];

	if (visibility === 'public') {
		conditions.push(eq(user.directoryVisibility, 'public'));
	} else {
		conditions.push(inArray(user.directoryVisibility, ['members', 'public']));
	}

	if (filters?.search) {
		conditions.push(ilike(user.name, `%${filters.search}%`));
	}

	if (filters?.instruments?.length) {
		conditions.push(
			sql`${user.instruments} && ${sql.raw(`ARRAY[${filters.instruments.map((i) => `'${i.replace(/'/g, "''")}'`).join(',')}]::text[]`)}`
		);
	}

	if (filters?.genres?.length) {
		conditions.push(
			sql`${user.genres} && ${sql.raw(`ARRAY[${filters.genres.map((g) => `'${g.replace(/'/g, "''")}'`).join(',')}]::text[]`)}`
		);
	}

	if (filters?.lookingForBand) {
		conditions.push(eq(user.lookingForBand, true));
	}

	return conditions;
}

/** Members-only directory — all active, non-opted-out members */
export async function listMembers(filters?: MemberFilters) {
	return db
		.select(memberSelect)
		.from(user)
		.where(and(...memberWhereConditions('members', filters)))
		.orderBy(asc(user.name));
}

/** Public directory — only directoryVisibility = 'public' */
export async function listPublicMembers(filters?: MemberFilters) {
	return db
		.select(memberSelect)
		.from(user)
		.where(and(...memberWhereConditions('public', filters)))
		.orderBy(asc(user.name));
}

/** Single member profile */
export async function getMemberProfile(
	userId: string,
	visibility: 'members' | 'public'
) {
	const conditions: SQL[] = [eq(user.id, userId), isNull(user.deletedAt)];

	if (visibility === 'public') {
		conditions.push(eq(user.directoryVisibility, 'public'));
	} else {
		conditions.push(inArray(user.directoryVisibility, ['members', 'public']));
	}

	const [row] = await db
		.select(memberSelect)
		.from(user)
		.where(and(...conditions));

	return row ?? null;
}

// ---------------------------------------------------------------------------
// Band queries
// ---------------------------------------------------------------------------

const bandSelect = {
	id: band.id,
	name: band.name,
	slug: band.slug,
	bio: band.bio,
	tagline: band.tagline,
	avatarKey: band.avatarKey,
	genres: band.genres,
	lookingForMembers: band.lookingForMembers,
	directoryContact: band.directoryContact,
	links: band.links,
	memberCount: sql<number>`count(case when ${bandMember.status} = 'active' then 1 end)::int`
} as const;

function bandWhereConditions(
	visibility: 'members' | 'public',
	filters?: BandFilters
): SQL[] {
	const conditions: SQL[] = [isNull(band.deletedAt)];

	if (visibility === 'public') {
		conditions.push(eq(band.directoryVisibility, 'public'));
	} else {
		conditions.push(inArray(band.directoryVisibility, ['members', 'public']));
	}

	if (filters?.search) {
		conditions.push(ilike(band.name, `%${filters.search}%`));
	}

	if (filters?.genres?.length) {
		conditions.push(
			sql`${band.genres} && ${sql.raw(`ARRAY[${filters.genres.map((g) => `'${g.replace(/'/g, "''")}'`).join(',')}]::text[]`)}`
		);
	}

	if (filters?.lookingForMembers) {
		conditions.push(eq(band.lookingForMembers, true));
	}

	return conditions;
}

/** Members-only band directory */
export async function listBands(filters?: BandFilters) {
	return db
		.select(bandSelect)
		.from(band)
		.leftJoin(bandMember, eq(bandMember.bandId, band.id))
		.where(and(...bandWhereConditions('members', filters)))
		.groupBy(band.id)
		.orderBy(asc(band.name));
}

/** Public band directory */
export async function listPublicBands(filters?: BandFilters) {
	return db
		.select(bandSelect)
		.from(band)
		.leftJoin(bandMember, eq(bandMember.bandId, band.id))
		.where(and(...bandWhereConditions('public', filters)))
		.groupBy(band.id)
		.orderBy(asc(band.name));
}

/** Single band profile by slug */
export async function getBandProfile(
	slug: string,
	visibility: 'members' | 'public'
) {
	const conditions: SQL[] = [eq(band.slug, slug), isNull(band.deletedAt)];

	if (visibility === 'public') {
		conditions.push(eq(band.directoryVisibility, 'public'));
	} else {
		conditions.push(inArray(band.directoryVisibility, ['members', 'public']));
	}

	const [row] = await db
		.select(bandSelect)
		.from(band)
		.leftJoin(bandMember, eq(bandMember.bandId, band.id))
		.where(and(...conditions))
		.groupBy(band.id);

	return row ?? null;
}

// ---------------------------------------------------------------------------
// Tag suggestions
// ---------------------------------------------------------------------------

/** Suggest instruments from existing user data */
export async function suggestInstruments(prefix: string) {
	const rows = await db.execute<{ tag: string }>(
		sql`SELECT DISTINCT unnest(instruments) AS tag FROM "user" WHERE instruments IS NOT NULL ORDER BY tag`
	);
	const lower = prefix.toLowerCase();
	return (rows as { tag: string }[])
		.map((r: { tag: string }) => r.tag)
		.filter((t: string) => t.toLowerCase().startsWith(lower));
}

/** Suggest genres from existing user + band data */
export async function suggestGenres(prefix: string) {
	const rows = await db.execute<{ tag: string }>(
		sql`SELECT DISTINCT tag FROM (
			SELECT unnest(genres) AS tag FROM "user" WHERE genres IS NOT NULL
			UNION
			SELECT unnest(genres) AS tag FROM "band" WHERE genres IS NOT NULL
		) t ORDER BY tag`
	);
	const lower = prefix.toLowerCase();
	return (rows as { tag: string }[])
		.map((r: { tag: string }) => r.tag)
		.filter((t: string) => t.toLowerCase().startsWith(lower));
}
