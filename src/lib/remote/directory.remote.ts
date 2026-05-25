import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { query, form } from '$app/server';
import { requireUser } from '$lib/server/authorization';
import { requireBandAdmin } from '$lib/server/band/band-context';
import {
	listMembers,
	listBands,
	listPublicMembers,
	listPublicBands,
	getMemberProfile as getMemberProfileService,
	getBandProfile as getBandProfileService,
	suggestInstruments,
	suggestGenres
} from '$lib/server/directory/directory-service';
import {
	getMemberProfileForEdit,
	updateMemberProfile,
	getBandProfileForEdit,
	updateBandProfile
} from '$lib/server/directory/profile-service';
import { getPublicUrl, isConfigured } from '$lib/server/storage';
import { db } from '$lib/server/db';
import { band, bandMember, bandGenre } from '$lib/server/db/schema/band';
import { user } from '$lib/server/db/schema/authentication';
import { eq, and, sql, isNull } from 'drizzle-orm';
import type { ProfileLink, DirectoryContact } from '$lib/server/db/schema/authentication';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

const filtersSchema = z.object({
	search: z.string().optional(),
	instruments: z.string().optional().transform((s) => {
		if (!s) return undefined;
		try { return JSON.parse(s) as string[]; } catch { return undefined; }
	}),
	genres: z.string().optional().transform((s) => {
		if (!s) return undefined;
		try { return JSON.parse(s) as string[]; } catch { return undefined; }
	}),
	lookingForBand: z.string().optional().transform((v) => v === 'true' ? true : undefined),
	lookingForMembers: z.string().optional().transform((v) => v === 'true' ? true : undefined)
});

export const getDirectoryMembers = query(filtersSchema, async (filters) => {
	requireUser();
	return listMembers({
		search: filters.search,
		instruments: filters.instruments,
		genres: filters.genres,
		lookingForBand: filters.lookingForBand
	});
});

export const getDirectoryBands = query(filtersSchema, async (filters) => {
	requireUser();
	const r2Available = isConfigured();
	const bands = await listBands({
		search: filters.search,
		genres: filters.genres,
		lookingForMembers: filters.lookingForMembers
	});
	return bands.map((b) => ({
		...b,
		avatarUrl: b.avatarKey && r2Available ? getPublicUrl(b.avatarKey) : null
	}));
});

export const getDirectoryMember = query(z.string(), async (userId) => {
	requireUser();
	return getMemberProfileService(userId, 'members');
});

export const getDirectoryBand = query(z.string(), async (slug) => {
	requireUser();
	const r2Available = isConfigured();

	const [row] = await db
		.select({
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
		})
		.from(band)
		.leftJoin(bandMember, eq(bandMember.bandId, band.id))
		.where(and(eq(band.slug, slug), isNull(band.deletedAt)))
		.groupBy(band.id);

	if (!row) throw error(404, 'Band not found');

	const genres = await db
		.select({ genre: bandGenre.genre })
		.from(bandGenre)
		.where(eq(bandGenre.bandId, row.id));

	const members = await db
		.select({
			id: bandMember.id,
			userId: bandMember.userId,
			role: bandMember.role,
			position: bandMember.position,
			userName: user.name,
			userImage: user.image
		})
		.from(bandMember)
		.innerJoin(user, eq(user.id, bandMember.userId))
		.where(and(eq(bandMember.bandId, row.id), eq(bandMember.status, 'active')))
		.orderBy(
			sql`case ${bandMember.role} when 'owner' then 0 when 'admin' then 1 else 2 end`,
			user.name
		);

	return {
		band: {
			id: row.id,
			name: row.name,
			slug: row.slug,
			bio: row.bio,
			tagline: row.tagline,
			avatarUrl: row.avatarKey && r2Available ? getPublicUrl(row.avatarKey) : null,
			memberCount: row.memberCount,
			genres: genres.map((r) => r.genre),
			lookingForMembers: row.lookingForMembers,
			directoryContact: row.directoryContact as DirectoryContact | null,
			links: (row.links as ProfileLink[] | null) ?? []
		},
		members: members.map((m) => ({
			id: m.id,
			role: m.role,
			position: m.position,
			userName: m.userName,
			userImage: m.userImage
		}))
	};
});

// ---------------------------------------------------------------------------
// Public directory queries
// ---------------------------------------------------------------------------

const publicFiltersSchema = z.object({
	search: z.string().optional(),
	instruments: z.string().optional().transform((s) => {
		if (!s) return undefined;
		try { return JSON.parse(s) as string[]; } catch { return undefined; }
	}),
	genres: z.string().optional().transform((s) => {
		if (!s) return undefined;
		try { return JSON.parse(s) as string[]; } catch { return undefined; }
	}),
	lookingForBand: z.string().optional().transform((v) => v === 'true' ? true : undefined),
	lookingForMembers: z.string().optional().transform((v) => v === 'true' ? true : undefined)
});

export const getPublicDirectory = query(publicFiltersSchema, async (filters) => {
	const r2Available = isConfigured();
	const [members, bands] = await Promise.all([
		listPublicMembers({ search: filters.search, instruments: filters.instruments, genres: filters.genres, lookingForBand: filters.lookingForBand }),
		listPublicBands({ search: filters.search, genres: filters.genres, lookingForMembers: filters.lookingForMembers })
	]);

	return {
		members: members.map((m) => ({
			id: m.id,
			name: m.name,
			pronouns: m.pronouns,
			image: m.image,
			tagline: m.tagline,
			instruments: m.instruments,
			genres: m.genres,
			lookingForBand: m.lookingForBand,
			memberSince: m.createdAt,
			bands: m.bands
		})),
		bands: bands.map((b) => ({
			id: b.id,
			name: b.name,
			slug: b.slug,
			bio: b.bio ? (b.bio.length > 120 ? b.bio.slice(0, 120).trimEnd() + '…' : b.bio) : null,
			tagline: b.tagline,
			avatarUrl: b.avatarKey && r2Available ? getPublicUrl(b.avatarKey) : null,
			memberCount: b.memberCount,
			genres: b.genres,
			lookingForMembers: b.lookingForMembers
		}))
	};
});

export const getPublicBandProfile = query(z.string(), async (slug) => {
	const r2Available = isConfigured();

	const [row] = await db
		.select({
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
		})
		.from(band)
		.leftJoin(bandMember, eq(bandMember.bandId, band.id))
		.where(and(eq(band.slug, slug), isNull(band.deletedAt)))
		.groupBy(band.id);

	if (!row) throw error(404, 'Band not found');

	const genres = await db
		.select({ genre: bandGenre.genre })
		.from(bandGenre)
		.where(eq(bandGenre.bandId, row.id));

	const members = await db
		.select({
			id: bandMember.id,
			userId: bandMember.userId,
			role: bandMember.role,
			position: bandMember.position,
			userName: user.name,
			userImage: user.image
		})
		.from(bandMember)
		.innerJoin(user, eq(user.id, bandMember.userId))
		.where(and(eq(bandMember.bandId, row.id), eq(bandMember.status, 'active')))
		.orderBy(
			sql`case ${bandMember.role} when 'owner' then 0 when 'admin' then 1 else 2 end`,
			user.name
		);

	return {
		band: {
			id: row.id,
			name: row.name,
			slug: row.slug,
			bio: row.bio,
			tagline: row.tagline,
			avatarUrl: row.avatarKey && r2Available ? getPublicUrl(row.avatarKey) : null,
			memberCount: row.memberCount,
			genres: genres.map((r) => r.genre),
			lookingForMembers: row.lookingForMembers,
			directoryContact: row.directoryContact as DirectoryContact | null,
			links: (row.links as ProfileLink[] | null) ?? []
		},
		members: members.map((m) => ({
			id: m.id,
			role: m.role,
			position: m.position,
			userName: m.userName,
			userImage: m.userImage
		}))
	};
});

export const getPublicMemberProfile = query(z.string(), async (id) => {
	const member = await getMemberProfileService(id, 'public');
	if (!member) throw error(404, 'Member not found');

	return {
		member: {
			id: member.id,
			name: member.name,
			pronouns: member.pronouns,
			image: member.image,
			bio: member.bio,
			tagline: member.tagline,
			instruments: member.instruments,
			genres: member.genres,
			lookingForBand: member.lookingForBand,
			directoryContact: member.directoryContact as DirectoryContact | null,
			links: (member.links as ProfileLink[] | null) ?? []
		}
	};
});

export const getInstrumentSuggestions = query(z.void(), async () => {
	requireUser();
	return suggestInstruments('');
});

export const getGenreSuggestions = query(z.void(), async () => {
	requireUser();
	return suggestGenres('');
});

// ---------------------------------------------------------------------------
// Member profile queries & forms
// ---------------------------------------------------------------------------

export const getMemberProfile = query(z.void(), async () => {
	const user = requireUser();
	return getMemberProfileForEdit(user.id);
});

const memberProfileSchema = z.object({
	tagline: z.string().max(150).optional().default(''),
	bio: z.string().max(2000).optional().default(''),
	instruments: z.string().transform((s) => {
		try { return JSON.parse(s) as string[]; } catch { return []; }
	}),
	genres: z.string().transform((s) => {
		try { return JSON.parse(s) as string[]; } catch { return []; }
	}),
	lookingForBand: z.string().optional().transform((v) => v === 'on'),
	directoryVisibility: z.enum(['hidden', 'members', 'public']).default('members'),
	contactEmail: z.string().max(255).optional().default(''),
	contactPhone: z.string().max(30).optional().default(''),
	contactSocial: z.string().max(255).optional().default(''),
	links: z.string().transform((s) => {
		try { return JSON.parse(s) as Array<{ label: string; url: string }>; } catch { return []; }
	})
});

export const saveMemberProfile = form(memberProfileSchema, async (data) => {
	const user = requireUser();

	const contact = {
		...(data.contactEmail ? { email: data.contactEmail } : {}),
		...(data.contactPhone ? { phone: data.contactPhone } : {}),
		...(data.contactSocial ? { social: data.contactSocial } : {})
	};

	await updateMemberProfile(user.id, {
		tagline: data.tagline || undefined,
		bio: data.bio || undefined,
		instruments: data.instruments,
		genres: data.genres,
		lookingForBand: data.lookingForBand,
		directoryVisibility: data.directoryVisibility,
		directoryContact: Object.keys(contact).length > 0 ? contact : undefined,
		links: data.links
	});

	void getMemberProfile().refresh();
	return { success: true };
});

// ---------------------------------------------------------------------------
// Band profile queries & forms
// ---------------------------------------------------------------------------

export const getBandProfile = query(z.void(), async () => {
	const { band } = await requireBandAdmin();
	return getBandProfileForEdit(band.id);
});

const bandProfileSchema = z.object({
	tagline: z.string().max(150).optional().default(''),
	genres: z.string().transform((s) => {
		try { return JSON.parse(s) as string[]; } catch { return []; }
	}),
	lookingForMembers: z.string().optional().transform((v) => v === 'on'),
	directoryVisibility: z.enum(['hidden', 'members', 'public']).default('public'),
	contactEmail: z.string().max(255).optional().default(''),
	contactPhone: z.string().max(30).optional().default(''),
	contactSocial: z.string().max(255).optional().default(''),
	links: z.string().transform((s) => {
		try { return JSON.parse(s) as Array<{ label: string; url: string }>; } catch { return []; }
	})
});

export const saveBandProfile = form(bandProfileSchema, async (data) => {
	const { user, band } = await requireBandAdmin();

	const contact = {
		...(data.contactEmail ? { email: data.contactEmail } : {}),
		...(data.contactPhone ? { phone: data.contactPhone } : {}),
		...(data.contactSocial ? { social: data.contactSocial } : {})
	};

	await updateBandProfile(band.id, user.id, {
		tagline: data.tagline || undefined,
		genres: data.genres,
		lookingForMembers: data.lookingForMembers,
		directoryVisibility: data.directoryVisibility,
		directoryContact: Object.keys(contact).length > 0 ? contact : undefined,
		links: data.links
	});

	void getBandProfile().refresh();
	return { success: true };
});
