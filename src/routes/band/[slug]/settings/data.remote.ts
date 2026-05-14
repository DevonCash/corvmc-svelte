import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { form, getRequestEvent } from '$app/server';
import {
	getBySlug,
	getUserRole,
	deleteBand
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

async function requireOwner() {
	const user = requireUser();
	const band = await requireBand();
	const role = await getUserRole(band.id, user.id);

	if (role !== 'owner') {
		throw error(403, 'Only the band owner can access settings');
	}

	return { user, band };
}

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

export const deleteBandForm = form(
	z.object({}),
	async () => {
		const { band } = await requireOwner();
		await deleteBand(band.id);
		return { success: true };
	}
);
