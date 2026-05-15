import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { query, form, getRequestEvent } from '$app/server';
import {
	getMemberProfileForEdit,
	updateMemberProfile
} from '$lib/server/directory/profile-service';
import {
	suggestInstruments,
	suggestGenres
} from '$lib/server/directory/directory-service';

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

export const getProfile = query(z.void(), async () => {
	const user = requireUser();
	return getMemberProfileForEdit(user.id);
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
// Mutations
// ---------------------------------------------------------------------------

const profileSchema = z.object({
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

export const saveProfile = form(profileSchema, async (data) => {
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

	void getProfile().refresh();
	return { success: true };
});
