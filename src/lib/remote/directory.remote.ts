import { z } from 'zod';
import { query, form } from '$app/server';
import { requireUser } from '$lib/server/authorization';
import { requireBandAdmin } from '$lib/server/band/band-context';
import {
	listMembers,
	listBands,
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
	return getBandProfileService(slug, 'members');
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
