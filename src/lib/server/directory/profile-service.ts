import { db } from '$lib/server/db';
import { user, userInstrument, userGenre } from '$lib/server/db/schema/auth';
import { band, bandMember, bandGenre } from '$lib/server/db/schema/band';
import { eq, and } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import type { DirectoryContact, DirectoryVisibility, ProfileLink } from '$lib/types/profile';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const MAX_LINKS = 20;
const MAX_TAGLINE = 150;
const MAX_BIO = 2000;
const MAX_TAGS = 20;

function validateLinks(links: unknown): ProfileLink[] {
	if (!Array.isArray(links)) return [];
	return links.slice(0, MAX_LINKS).map((l) => ({
		label: String(l.label ?? '').slice(0, 100),
		url: String(l.url ?? '').slice(0, 500)
	}));
}

function validateContact(contact: unknown): DirectoryContact | null {
	if (!contact || typeof contact !== 'object') return null;
	const c = contact as Record<string, unknown>;
	const result: DirectoryContact = {};
	if (c.email) result.email = String(c.email).slice(0, 255);
	if (c.phone) result.phone = String(c.phone).slice(0, 30);
	if (c.social) result.social = String(c.social).slice(0, 255);
	if (c.address) result.address = String(c.address).slice(0, 500);
	if (c.visibility) result.visibility = String(c.visibility);
	return Object.keys(result).length > 0 ? result : null;
}

function validateTags(tags: unknown): string[] {
	if (!Array.isArray(tags)) return [];
	return tags
		.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
		.map((t) => t.trim().toLowerCase().slice(0, 50))
		.slice(0, MAX_TAGS);
}

// ---------------------------------------------------------------------------
// Member profile
// ---------------------------------------------------------------------------

export type MemberProfileData = {
	bio?: string;
	tagline?: string;
	instruments?: string[];
	genres?: string[];
	lookingForBand?: boolean;
	directoryVisibility?: DirectoryVisibility;
	directoryContact?: DirectoryContact;
	links?: ProfileLink[];
};

export async function updateMemberProfile(userId: string, data: MemberProfileData) {
	let mergedContact: DirectoryContact | null = null;
	if (data.directoryContact) {
		const [existing] = await db
			.select({ directoryContact: user.directoryContact })
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);
		const prev = (existing?.directoryContact as DirectoryContact) ?? {};
		mergedContact = validateContact({ ...prev, ...data.directoryContact });
	}

	const queries: BatchItem<'sqlite'>[] = [
		db
			.update(user)
			.set({
				bio: data.bio?.slice(0, MAX_BIO) ?? null,
				tagline: data.tagline?.slice(0, MAX_TAGLINE) ?? null,
				lookingForBand: data.lookingForBand ?? false,
				directoryVisibility: data.directoryVisibility ?? 'members',
				directoryContact: mergedContact,
				links: data.links ? validateLinks(data.links) : null,
				updatedAt: new Date()
			})
			.where(eq(user.id, userId))
	];

	if (data.instruments !== undefined) {
		queries.push(db.delete(userInstrument).where(eq(userInstrument.userId, userId)));
		const tags = validateTags(data.instruments);
		if (tags.length > 0) {
			queries.push(
				db.insert(userInstrument).values(tags.map((instrument) => ({ userId, instrument })))
			);
		}
	}

	if (data.genres !== undefined) {
		queries.push(db.delete(userGenre).where(eq(userGenre.userId, userId)));
		const tags = validateTags(data.genres);
		if (tags.length > 0) {
			queries.push(
				db.insert(userGenre).values(tags.map((genre) => ({ userId, genre })))
			);
		}
	}

	await db.batch(queries as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);
}

/** Load current profile data for the edit form */
export async function getMemberProfileForEdit(userId: string) {
	const [row] = await db
		.select({
			bio: user.bio,
			tagline: user.tagline,
			lookingForBand: user.lookingForBand,
			directoryVisibility: user.directoryVisibility,
			directoryContact: user.directoryContact,
			links: user.links
		})
		.from(user)
		.where(eq(user.id, userId));

	if (!row) return null;

	const instruments = await db
		.select({ instrument: userInstrument.instrument })
		.from(userInstrument)
		.where(eq(userInstrument.userId, userId));

	const genres = await db
		.select({ genre: userGenre.genre })
		.from(userGenre)
		.where(eq(userGenre.userId, userId));

	return {
		...row,
		instruments: instruments.map((r) => r.instrument),
		genres: genres.map((r) => r.genre)
	};
}

// ---------------------------------------------------------------------------
// Band profile
// ---------------------------------------------------------------------------

export type BandProfileData = {
	tagline?: string;
	genres?: string[];
	lookingForMembers?: boolean;
	directoryVisibility?: DirectoryVisibility;
	directoryContact?: DirectoryContact;
	links?: ProfileLink[];
};

async function requireBandAdmin(bandId: string, userId: string) {
	const [membership] = await db
		.select({ role: bandMember.role })
		.from(bandMember)
		.where(
			and(
				eq(bandMember.bandId, bandId),
				eq(bandMember.userId, userId),
				eq(bandMember.status, 'active')
			)
		);

	if (!membership || !['owner', 'admin'].includes(membership.role)) {
		throw new Error('Not authorized to edit this band profile');
	}
}

export async function updateBandProfile(
	bandId: string,
	userId: string,
	data: BandProfileData
) {
	await requireBandAdmin(bandId, userId);

	let mergedContact: DirectoryContact | null = null;
	if (data.directoryContact) {
		const [existing] = await db
			.select({ directoryContact: band.directoryContact })
			.from(band)
			.where(eq(band.id, bandId))
			.limit(1);
		const prev = (existing?.directoryContact as DirectoryContact) ?? {};
		mergedContact = validateContact({ ...prev, ...data.directoryContact });
	}

	const queries: BatchItem<'sqlite'>[] = [
		db
			.update(band)
			.set({
				tagline: data.tagline?.slice(0, MAX_TAGLINE) ?? null,
				lookingForMembers: data.lookingForMembers ?? false,
				directoryVisibility: data.directoryVisibility ?? 'public',
				directoryContact: mergedContact,
				links: data.links ? validateLinks(data.links) : null,
				updatedAt: new Date()
			})
			.where(eq(band.id, bandId))
	];

	if (data.genres !== undefined) {
		queries.push(db.delete(bandGenre).where(eq(bandGenre.bandId, bandId)));
		const tags = validateTags(data.genres);
		if (tags.length > 0) {
			queries.push(
				db.insert(bandGenre).values(tags.map((genre) => ({ bandId, genre })))
			);
		}
	}

	await db.batch(queries as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);
}

/** Load current band profile data for the edit form */
export async function getBandProfileForEdit(bandId: string) {
	const [row] = await db
		.select({
			tagline: band.tagline,
			lookingForMembers: band.lookingForMembers,
			directoryVisibility: band.directoryVisibility,
			directoryContact: band.directoryContact,
			links: band.links
		})
		.from(band)
		.where(eq(band.id, bandId));

	if (!row) return null;

	const genres = await db
		.select({ genre: bandGenre.genre })
		.from(bandGenre)
		.where(eq(bandGenre.bandId, bandId));

	return {
		...row,
		genres: genres.map((r) => r.genre)
	};
}
