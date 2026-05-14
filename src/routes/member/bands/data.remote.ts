import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { form, getRequestEvent } from '$app/server';
import {
	create,
	acceptInvitation,
	declineInvitation
} from '$lib/server/band/band-service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireUser() {
	const { locals } = getRequestEvent();
	if (!locals.user) throw error(401, 'Not authenticated');
	return locals.user;
}

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

export const createBand = form(
	z.object({
		name: z.string().min(1, 'Band name is required').max(255),
		bio: z.string().max(2000).optional().default('')
	}),
	async (data) => {
		const currentUser = requireUser();

		const band = await create(currentUser.id, {
			name: data.name,
			bio: data.bio || undefined
		});

		return { success: true, slug: band.slug };
	}
);

export const acceptInvite = form(
	z.object({
		memberId: z.string().min(1)
	}),
	async (data) => {
		const currentUser = requireUser();
		await acceptInvitation(data.memberId, currentUser.id);
		return { success: true };
	}
);

export const declineInvite = form(
	z.object({
		memberId: z.string().min(1)
	}),
	async (data) => {
		const currentUser = requireUser();
		await declineInvitation(data.memberId, currentUser.id);
		return { success: true };
	}
);
