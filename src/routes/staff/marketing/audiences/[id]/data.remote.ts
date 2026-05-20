import { z } from 'zod';
import { query, command } from '$app/server';
import { getRequestEvent } from '$app/server';
import { requireStaff } from '$lib/server/authorization';
import {
	getAudience,
	updateAudience,
	listSubscribers
} from '$lib/server/marketing/audience-service';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const getAudienceDetail = query(z.string(), async (id) => {
	await requireStaff();
	return getAudience(id);
});

export const getAudienceSubscribers = query(z.string(), async (audienceId) => {
	await requireStaff();
	return listSubscribers(audienceId);
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

const updateSchema = z.object({
	name: z.string().trim().min(1).max(255).optional(),
	description: z.string().trim().max(2000).optional(),
	allowOptIn: z.boolean().optional()
});

export const updateAudienceCommand = command(updateSchema, async (data) => {
	await requireStaff();
	const { params } = getRequestEvent();
	const id = params.id!;
	await updateAudience(id, data);
	void getAudienceDetail(id).refresh();
	return { success: true };
});
