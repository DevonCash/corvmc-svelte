import { db } from '$lib/server/db';
import { userInstrument, userGenre } from '$lib/server/db/schema/authentication';
import { bandGenre } from '$lib/server/db/schema/band';
import { asc, like, sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MemberFilters = {
	search?: string;
	instruments?: string[];
	genres?: string[];
	lookingForBand?: boolean;
	availableForHire?: boolean;
	teachesLessons?: boolean;
};

export type BandFilters = {
	search?: string;
	genres?: string[];
	lookingForMembers?: boolean;
};

// ---------------------------------------------------------------------------
// Member queries
// ---------------------------------------------------------------------------

type MemberWhere = NonNullable<
	NonNullable<Parameters<typeof db.query.user.findMany>[0]>['where']
>;

function memberWhereConditions(
	visibility: 'members' | 'public',
	filters?: MemberFilters
): MemberWhere {
	const conditions: MemberWhere[] = [{ deletedAt: { isNull: true } }];

	if (visibility === 'public') {
		conditions.push({ directoryVisibility: 'public' });
	} else {
		conditions.push({ directoryVisibility: { in: ['members', 'public'] } });
	}

	if (filters?.search) {
		conditions.push({ name: { like: `%${filters.search}%` } });
	}

	if (filters?.instruments?.length) {
		conditions.push({
			RAW: (table, ops) =>
				sql`EXISTS (SELECT 1 FROM ${userInstrument} WHERE ${userInstrument.userId} = ${table.id} AND ${userInstrument.instrument} IN (${sql.join(filters.instruments!.map(i => sql`${i}`), sql`, `)}))`
		});
	}

	if (filters?.genres?.length) {
		conditions.push({
			RAW: (table, ops) =>
				sql`EXISTS (SELECT 1 FROM ${userGenre} WHERE ${userGenre.userId} = ${table.id} AND ${userGenre.genre} IN (${sql.join(filters.genres!.map(g => sql`${g}`), sql`, `)}))`
		});
	}

	if (filters?.lookingForBand) {
		conditions.push({ lookingForBand: true });
	}

	if (filters?.availableForHire) {
		conditions.push({ availableForHire: true });
	}

	if (filters?.teachesLessons) {
		conditions.push({ teachesLessons: true });
	}

	return { AND: conditions };
}

function mapMemberRow<T extends {
	instruments: { instrument: string }[];
	genres: { genre: string }[];
	bandMembers?: { status: string; band: { name: string; slug: string } | null }[];
}>(row: T) {
	const { instruments, genres, bandMembers, ...rest } = row;
	return {
		...rest,
		instruments: instruments.map(r => r.instrument),
		genres: genres.map(r => r.genre),
		bands: (bandMembers ?? [])
			.filter(m => m.status === 'active' && m.band)
			.map(m => ({ name: m.band!.name, slug: m.band!.slug })),
	};
}

const memberColumns = {
	id: true,
	name: true,
	pronouns: true,
	image: true,
	bio: true,
	tagline: true,
	lookingForBand: true,
	availableForHire: true,
	teachesLessons: true,
	directoryContact: true,
	links: true,
	createdAt: true,
} as const;

/** Members-only directory — all active, non-opted-out members */
export async function listMembers(filters?: MemberFilters) {
	const rows = await db.query.user.findMany({
		where: memberWhereConditions('members', filters),
		with: {
			instruments: true,
			genres: true,
			bandMembers: {
				columns: { status: true },
				with: { band: { columns: { name: true, slug: true } } },
			},
		},
		orderBy: { name: 'asc' },
		columns: memberColumns,
	});
	return rows.map(mapMemberRow);
}

/** Public directory — only directoryVisibility = 'public' */
export async function listPublicMembers(filters?: MemberFilters) {
	const rows = await db.query.user.findMany({
		where: memberWhereConditions('public', filters),
		with: {
			instruments: true,
			genres: true,
			bandMembers: {
				columns: { status: true },
				with: { band: { columns: { name: true, slug: true } } },
			},
		},
		orderBy: { name: 'asc' },
		columns: memberColumns,
	});
	return rows.map(mapMemberRow);
}

/** Single member profile */
export async function getMemberProfile(
	userId: string,
	visibility: 'members' | 'public'
) {
	const conditions: MemberWhere[] = [
		{ id: userId },
		{ deletedAt: { isNull: true } },
	];

	if (visibility === 'public') {
		conditions.push({ directoryVisibility: 'public' });
	} else {
		conditions.push({ directoryVisibility: { in: ['members', 'public'] } });
	}

	const row = await db.query.user.findFirst({
		where: { AND: conditions },
		with: {
			instruments: true,
			genres: true,
			bandMembers: {
				columns: { status: true },
				with: { band: { columns: { name: true, slug: true } } },
			},
		},
		columns: memberColumns,
	});

	if (!row) return null;

	return mapMemberRow(row);
}

// ---------------------------------------------------------------------------
// Band queries
// ---------------------------------------------------------------------------

type BandWhere = NonNullable<
	NonNullable<Parameters<typeof db.query.band.findMany>[0]>['where']
>;

function bandWhereConditions(
	visibility: 'members' | 'public',
	filters?: BandFilters
): BandWhere {
	const conditions: BandWhere[] = [{ deletedAt: { isNull: true } }];

	if (visibility === 'public') {
		conditions.push({ directoryVisibility: 'public' });
	} else {
		conditions.push({ directoryVisibility: { in: ['members', 'public'] } });
	}

	if (filters?.search) {
		conditions.push({ name: { like: `%${filters.search}%` } });
	}

	if (filters?.genres?.length) {
		conditions.push({
			RAW: (table, ops) =>
				sql`EXISTS (SELECT 1 FROM ${bandGenre} WHERE ${bandGenre.bandId} = ${table.id} AND ${bandGenre.genre} IN (${sql.join(filters.genres!.map(g => sql`${g}`), sql`, `)}))`
		});
	}

	if (filters?.lookingForMembers) {
		conditions.push({ lookingForMembers: true });
	}

	return { AND: conditions };
}

function mapBandRow<T extends { genres: { genre: string }[]; members: { status: string }[] }>(row: T) {
	const { genres, members, ...rest } = row;
	return {
		...rest,
		genres: genres.map(r => r.genre),
		memberCount: members.filter(m => m.status === 'active').length,
	};
}

const bandColumns = {
	id: true,
	name: true,
	slug: true,
	bio: true,
	tagline: true,
	avatarKey: true,
	lookingForMembers: true,
	directoryContact: true,
	links: true,
} as const;

/** Members-only band directory */
export async function listBands(filters?: BandFilters) {
	const rows = await db.query.band.findMany({
		where: bandWhereConditions('members', filters),
		with: {
			genres: true,
			members: { columns: { status: true } },
		},
		orderBy: { name: 'asc' },
		columns: bandColumns,
	});
	return rows.map(mapBandRow);
}

/** Public band directory */
export async function listPublicBands(filters?: BandFilters) {
	const rows = await db.query.band.findMany({
		where: bandWhereConditions('public', filters),
		with: {
			genres: true,
			members: { columns: { status: true } },
		},
		orderBy: { name: 'asc' },
		columns: bandColumns,
	});
	return rows.map(mapBandRow);
}

/** Single band profile by slug */
export async function getBandProfile(
	slug: string,
	visibility: 'members' | 'public'
) {
	const conditions: BandWhere[] = [
		{ slug },
		{ deletedAt: { isNull: true } },
	];

	if (visibility === 'public') {
		conditions.push({ directoryVisibility: 'public' });
	} else {
		conditions.push({ directoryVisibility: { in: ['members', 'public'] } });
	}

	const row = await db.query.band.findFirst({
		where: { AND: conditions },
		with: {
			genres: true,
			members: { columns: { status: true } },
		},
		columns: bandColumns,
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
		.where(like(userInstrument.instrument, `${prefix}%`))
		.orderBy(asc(userInstrument.instrument))
		.limit(10);

	return rows.map(r => r.tag);
}

export async function suggestGenres(prefix: string) {
	const [userRows, bandRows] = await Promise.all([
		db
			.selectDistinct({ tag: userGenre.genre })
			.from(userGenre)
			.where(like(userGenre.genre, `${prefix}%`))
			.limit(10),
		db
			.selectDistinct({ tag: bandGenre.genre })
			.from(bandGenre)
			.where(like(bandGenre.genre, `${prefix}%`))
			.limit(10)
	]);

	return [...new Set([...userRows, ...bandRows].map(r => r.tag))].sort().slice(0, 10);
}
