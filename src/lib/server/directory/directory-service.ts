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
// Member queries
// ---------------------------------------------------------------------------

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

function mapMemberRow(row: {
	id: string;
	instruments: { instrument: string }[];
	genres: { genre: string }[];
	[key: string]: unknown;
}) {
	const { instruments, genres, ...rest } = row;
	return {
		...rest,
		instruments: instruments.map(r => r.instrument),
		genres: genres.map(r => r.genre),
	};
}

/** Members-only directory — all active, non-opted-out members */
export async function listMembers(filters?: MemberFilters) {
	const rows = await db.query.user.findMany({
		where: and(...memberWhereConditions('members', filters)),
		with: { instruments: true, genres: true },
		orderBy: asc(user.name),
		columns: {
			id: true,
			name: true,
			pronouns: true,
			image: true,
			bio: true,
			tagline: true,
			lookingForBand: true,
			directoryContact: true,
			links: true,
			createdAt: true,
		},
	});
	return rows.map(mapMemberRow);
}

/** Public directory — only directoryVisibility = 'public' */
export async function listPublicMembers(filters?: MemberFilters) {
	const rows = await db.query.user.findMany({
		where: and(...memberWhereConditions('public', filters)),
		with: { instruments: true, genres: true },
		orderBy: asc(user.name),
		columns: {
			id: true,
			name: true,
			pronouns: true,
			image: true,
			bio: true,
			tagline: true,
			lookingForBand: true,
			directoryContact: true,
			links: true,
			createdAt: true,
		},
	});
	return rows.map(mapMemberRow);
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

	const row = await db.query.user.findFirst({
		where: and(...conditions),
		with: { instruments: true, genres: true },
		columns: {
			id: true,
			name: true,
			pronouns: true,
			image: true,
			bio: true,
			tagline: true,
			lookingForBand: true,
			directoryContact: true,
			links: true,
			createdAt: true,
		},
	});

	if (!row) return null;

	return mapMemberRow(row);
}

// ---------------------------------------------------------------------------
// Band queries
// ---------------------------------------------------------------------------

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

function mapBandRow(row: {
	id: string;
	genres: { genre: string }[];
	members: { status: string }[];
	[key: string]: unknown;
}) {
	const { genres, members, ...rest } = row;
	return {
		...rest,
		genres: genres.map(r => r.genre),
		memberCount: members.filter(m => m.status === 'active').length,
	};
}

/** Members-only band directory */
export async function listBands(filters?: BandFilters) {
	const rows = await db.query.band.findMany({
		where: and(...bandWhereConditions('members', filters)),
		with: {
			genres: true,
			members: { columns: { status: true } },
		},
		orderBy: asc(band.name),
		columns: {
			id: true,
			name: true,
			slug: true,
			bio: true,
			tagline: true,
			avatarKey: true,
			lookingForMembers: true,
			directoryContact: true,
			links: true,
		},
	});
	return rows.map(mapBandRow);
}

/** Public band directory */
export async function listPublicBands(filters?: BandFilters) {
	const rows = await db.query.band.findMany({
		where: and(...bandWhereConditions('public', filters)),
		with: {
			genres: true,
			members: { columns: { status: true } },
		},
		orderBy: asc(band.name),
		columns: {
			id: true,
			name: true,
			slug: true,
			bio: true,
			tagline: true,
			avatarKey: true,
			lookingForMembers: true,
			directoryContact: true,
			links: true,
		},
	});
	return rows.map(mapBandRow);
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

	const row = await db.query.band.findFirst({
		where: and(...conditions),
		with: {
			genres: true,
			members: { columns: { status: true } },
		},
		columns: {
			id: true,
			name: true,
			slug: true,
			bio: true,
			tagline: true,
			avatarKey: true,
			lookingForMembers: true,
			directoryContact: true,
			links: true,
		},
	});

	if (!row) return null;

	return mapBandRow(row);
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
