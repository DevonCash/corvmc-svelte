import { db } from '$lib/server/db';
import { user, userInstrument, userGenre } from '$lib/server/db/schema/auth';
import { band, bandMember, bandGenre } from '$lib/server/db/schema/band';
import { isNull, eq, asc, sql, and, inArray, like } from 'drizzle-orm';
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
// Tag helpers — bulk-fetch junction table rows and group by parent ID
// ---------------------------------------------------------------------------

async function fetchUserInstruments(userIds: string[]) {
	if (userIds.length === 0) return new Map<string, string[]>();
	const rows = await db
		.select({ userId: userInstrument.userId, instrument: userInstrument.instrument })
		.from(userInstrument)
		.where(inArray(userInstrument.userId, userIds));
	const map = new Map<string, string[]>();
	for (const r of rows) {
		const list = map.get(r.userId) ?? [];
		list.push(r.instrument);
		map.set(r.userId, list);
	}
	return map;
}

async function fetchUserGenres(userIds: string[]) {
	if (userIds.length === 0) return new Map<string, string[]>();
	const rows = await db
		.select({ userId: userGenre.userId, genre: userGenre.genre })
		.from(userGenre)
		.where(inArray(userGenre.userId, userIds));
	const map = new Map<string, string[]>();
	for (const r of rows) {
		const list = map.get(r.userId) ?? [];
		list.push(r.genre);
		map.set(r.userId, list);
	}
	return map;
}

async function fetchBandGenres(bandIds: string[]) {
	if (bandIds.length === 0) return new Map<string, string[]>();
	const rows = await db
		.select({ bandId: bandGenre.bandId, genre: bandGenre.genre })
		.from(bandGenre)
		.where(inArray(bandGenre.bandId, bandIds));
	const map = new Map<string, string[]>();
	for (const r of rows) {
		const list = map.get(r.bandId) ?? [];
		list.push(r.genre);
		map.set(r.bandId, list);
	}
	return map;
}

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
		conditions.push(like(user.name, `%${filters.search}%`));
	}

	if (filters?.instruments?.length) {
		conditions.push(
			sql`EXISTS (SELECT 1 FROM ${userInstrument} WHERE ${userInstrument.userId} = ${user.id} AND ${userInstrument.instrument} IN (${sql.join(filters.instruments.map(i => sql`${i}`), sql`, `)}))`
		);
	}

	if (filters?.genres?.length) {
		conditions.push(
			sql`EXISTS (SELECT 1 FROM ${userGenre} WHERE ${userGenre.userId} = ${user.id} AND ${userGenre.genre} IN (${sql.join(filters.genres.map(g => sql`${g}`), sql`, `)}))`
		);
	}

	if (filters?.lookingForBand) {
		conditions.push(eq(user.lookingForBand, true));
	}

	return conditions;
}

async function hydrateMembers<T extends { id: string }>(rows: T[]) {
	const ids = rows.map(r => r.id);
	const [instrumentsMap, genresMap] = await Promise.all([
		fetchUserInstruments(ids),
		fetchUserGenres(ids)
	]);
	return rows.map(r => ({
		...r,
		instruments: instrumentsMap.get(r.id) ?? [],
		genres: genresMap.get(r.id) ?? []
	}));
}

/** Members-only directory — all active, non-opted-out members */
export async function listMembers(filters?: MemberFilters) {
	const rows = await db
		.select(memberSelect)
		.from(user)
		.where(and(...memberWhereConditions('members', filters)))
		.orderBy(asc(user.name));
	return hydrateMembers(rows);
}

/** Public directory — only directoryVisibility = 'public' */
export async function listPublicMembers(filters?: MemberFilters) {
	const rows = await db
		.select(memberSelect)
		.from(user)
		.where(and(...memberWhereConditions('public', filters)))
		.orderBy(asc(user.name));
	return hydrateMembers(rows);
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

	if (!row) return null;

	const [instruments, genres] = await Promise.all([
		db.select({ instrument: userInstrument.instrument }).from(userInstrument).where(eq(userInstrument.userId, userId)),
		db.select({ genre: userGenre.genre }).from(userGenre).where(eq(userGenre.userId, userId))
	]);

	return {
		...row,
		instruments: instruments.map(r => r.instrument),
		genres: genres.map(r => r.genre)
	};
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
	lookingForMembers: band.lookingForMembers,
	directoryContact: band.directoryContact,
	links: band.links,
	memberCount: sql<number>`cast(count(case when ${bandMember.status} = 'active' then 1 end) as integer)`
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
		conditions.push(like(band.name, `%${filters.search}%`));
	}

	if (filters?.genres?.length) {
		conditions.push(
			sql`EXISTS (SELECT 1 FROM ${bandGenre} WHERE ${bandGenre.bandId} = ${band.id} AND ${bandGenre.genre} IN (${sql.join(filters.genres.map(g => sql`${g}`), sql`, `)}))`
		);
	}

	if (filters?.lookingForMembers) {
		conditions.push(eq(band.lookingForMembers, true));
	}

	return conditions;
}

async function hydrateBands<T extends { id: string }>(rows: T[]) {
	const genresMap = await fetchBandGenres(rows.map(r => r.id));
	return rows.map(r => ({
		...r,
		genres: genresMap.get(r.id) ?? []
	}));
}

/** Members-only band directory */
export async function listBands(filters?: BandFilters) {
	const rows = await db
		.select(bandSelect)
		.from(band)
		.leftJoin(bandMember, eq(bandMember.bandId, band.id))
		.where(and(...bandWhereConditions('members', filters)))
		.groupBy(band.id)
		.orderBy(asc(band.name));
	return hydrateBands(rows);
}

/** Public band directory */
export async function listPublicBands(filters?: BandFilters) {
	const rows = await db
		.select(bandSelect)
		.from(band)
		.leftJoin(bandMember, eq(bandMember.bandId, band.id))
		.where(and(...bandWhereConditions('public', filters)))
		.groupBy(band.id)
		.orderBy(asc(band.name));
	return hydrateBands(rows);
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

	if (!row) return null;

	const genres = await db
		.select({ genre: bandGenre.genre })
		.from(bandGenre)
		.where(eq(bandGenre.bandId, row.id));

	return {
		...row,
		genres: genres.map(r => r.genre)
	};
}

// ---------------------------------------------------------------------------
// Tag suggestions
// ---------------------------------------------------------------------------

export async function suggestInstruments(prefix: string) {
	const rows = await db
		.selectDistinct({ tag: userInstrument.instrument })
		.from(userInstrument)
		.orderBy(asc(userInstrument.instrument));

	const lower = prefix.toLowerCase();
	return rows.map(r => r.tag).filter(t => t.toLowerCase().startsWith(lower));
}

export async function suggestGenres(prefix: string) {
	const userRows = await db
		.selectDistinct({ tag: userGenre.genre })
		.from(userGenre);

	const bandRows = await db
		.selectDistinct({ tag: bandGenre.genre })
		.from(bandGenre);

	const allGenres = [...new Set([...userRows, ...bandRows].map(r => r.tag))].sort();
	const lower = prefix.toLowerCase();
	return allGenres.filter(t => t.toLowerCase().startsWith(lower));
}
