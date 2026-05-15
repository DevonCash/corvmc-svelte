import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/auth';
import { band, bandMember } from '$lib/server/db/schema/band';
import { eq, and } from 'drizzle-orm';
import type { DirectoryContact, ProfileLink } from '$lib/types/profile';

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
	directoryOptOut?: boolean;
	publicListing?: boolean;
	directoryContact?: DirectoryContact;
	links?: ProfileLink[];
};

export async function updateMemberProfile(userId: string, data: MemberProfileData) {
	await db
		.update(user)
		.set({
			bio: data.bio?.slice(0, MAX_BIO) ?? null,
			tagline: data.tagline?.slice(0, MAX_TAGLINE) ?? null,
			instruments: data.instruments ? validateTags(data.instruments) : null,
			genres: data.genres ? validateTags(data.genres) : null,
			lookingForBand: data.lookingForBand ?? false,
			directoryOptOut: data.directoryOptOut ?? false,
			publicListing: data.publicListing ?? false,
			directoryContact: data.directoryContact
				? validateContact(data.directoryContact)
				: null,
			links: data.links ? validateLinks(data.links) : null,
			updatedAt: new Date()
		})
		.where(eq(user.id, userId));
}

/** Load current profile data for the edit form */
export async function getMemberProfileForEdit(userId: string) {
	const [row] = await db
		.select({
			bio: user.bio,
			tagline: user.tagline,
			instruments: user.instruments,
			genres: user.genres,
			lookingForBand: user.lookingForBand,
			directoryOptOut: user.directoryOptOut,
			publicListing: user.publicListing,
			directoryContact: user.directoryContact,
			links: user.links
		})
		.from(user)
		.where(eq(user.id, userId));

	return row ?? null;
}

// ---------------------------------------------------------------------------
// Band profile
// ---------------------------------------------------------------------------

export type BandProfileData = {
	tagline?: string;
	genres?: string[];
	lookingForMembers?: boolean;
	directoryOptOut?: boolean;
	publicListing?: boolean;
	directoryContact?: DirectoryContact;
	links?: ProfileLink[];
};

/** Check the caller is an owner or admin of the band */
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

	await db
		.update(band)
		.set({
			tagline: data.tagline?.slice(0, MAX_TAGLINE) ?? null,
			genres: data.genres ? validateTags(data.genres) : null,
			lookingForMembers: data.lookingForMembers ?? false,
			directoryOptOut: data.directoryOptOut ?? false,
			publicListing: data.publicListing ?? false,
			directoryContact: data.directoryContact
				? validateContact(data.directoryContact)
				: null,
			links: data.links ? validateLinks(data.links) : null,
			updatedAt: new Date()
		})
		.where(eq(band.id, bandId));
}

/** Load current band profile data for the edit form */
export async function getBandProfileForEdit(bandId: string) {
	const [row] = await db
		.select({
			tagline: band.tagline,
			genres: band.genres,
			lookingForMembers: band.lookingForMembers,
			directoryOptOut: band.directoryOptOut,
			publicListing: band.publicListing,
			directoryContact: band.directoryContact,
			links: band.links
		})
		.from(band)
		.where(eq(band.id, bandId));

	return row ?? null;
}
