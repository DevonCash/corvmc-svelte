import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { query, form, getRequestEvent } from '$app/server';
import { getBySlug, getUserRole } from '$lib/server/band/band-service';
import {
	getBandProfileForEdit,
	updateBandProfile
} from '$lib/server/directory/profile-service';
import { suggestGenres } from '$lib/server/directory/directory-service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireUser() {
	const { locals } = getRequestEvent();
	if (!locals.user) throw error(401, 'Not authenticated');
	return locals.user;
}

async function requireBand() {
	const { params } = getRequestEvent();
	const band = await getBySlug(params.slug!);
	if (!band) throw error(404, 'Band not found');
	return band;
}

async function requireAdmin() {
	const user = requireUser();
	const band = await requireBand();
	const role = await getUserRole(band.id, user.id);

	if (!role || (role !== 'owner' && role !== 'admin')) {
		throw error(403, 'Only owners and admins can edit the band profile');
	}

	return { user, band, role };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const getProfile = query(z.void(), async () => {
	const { band } = await requireAdmin();
	return getBandProfileForEdit(band.id);
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

export const saveProfile = form(profileSchema, async (data) => {
	const { user, band } = await requireAdmin();

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

	void getProfile().refresh();
	return { success: true };
});
