import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { form, getRequestEvent } from '$app/server';
import {
	getBySlug,
	getUserRole,
	update as updateBandService
} from '$lib/server/band/band-service';

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
		throw error(403, 'Only owners and admins can edit the band');
	}

	return { user, band, role };
}

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

export const updateBand = form(
	z.object({
		name: z.string().min(1, 'Name is required').max(200),
		bio: z.string().max(2000).optional().default('')
	}),
	async (data) => {
		const { band } = await requireAdmin();

		const updated = await updateBandService(band.id, {
			name: data.name,
			bio: data.bio
		});

		return { success: true, slug: updated.slug };
	}
);
