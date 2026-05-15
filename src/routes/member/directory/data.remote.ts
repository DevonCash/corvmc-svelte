import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { query, getRequestEvent } from '$app/server';
import {
	listMembers,
	listBands,
	getMemberProfile,
	getBandProfile,
	suggestInstruments,
	suggestGenres
} from '$lib/server/directory/directory-service';
import { getPublicUrl, isConfigured } from '$lib/server/storage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireUser() {
	const { locals } = getRequestEvent();
	if (!locals.user) throw error(401, 'Not authenticated');
	return locals.user;
}

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

export const getMembers = query(filtersSchema, async (filters) => {
	requireUser();
	return listMembers({
		search: filters.search,
		instruments: filters.instruments,
		genres: filters.genres,
		lookingForBand: filters.lookingForBand
	});
});

export const getBands = query(filtersSchema, async (filters) => {
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

export const getMember = query(z.string(), async (userId) => {
	requireUser();
	return getMemberProfile(userId, 'members');
});

export const getBand = query(z.string(), async (slug) => {
	requireUser();
	return getBandProfile(slug, 'members');
});

export const getInstrumentSuggestions = query(z.void(), async () => {
	requireUser();
	return suggestInstruments('');
});

export const getGenreSuggestions = query(z.void(), async () => {
	requireUser();
	return suggestGenres('');
});
