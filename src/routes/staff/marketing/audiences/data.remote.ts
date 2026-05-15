import { z } from 'zod';
import { query, command } from '$app/server';
import { requireStaff } from '$lib/server/authorization';
import {
	listAudiences,
	createAudience,
	getAudience
} from '$lib/server/marketing/audience-service';
import { generateSlug } from '$lib/server/utils/slug';
import { ensureUniqueSlug } from '$lib/server/utils/slug';
import { audience } from '$lib/server/db/schema/marketing';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const getAudiences = query(z.void(), async () => {
	await requireStaff();
	return listAudiences();
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

const createAudienceSchema = z.object({
	name: z.string().trim().min(1).max(255),
	slug: z.string().trim().min(1).max(100).optional(),
	description: z.string().trim().max(2000).optional(),
	allowOptIn: z.boolean().default(false)
});

export const createAudienceCommand = command(createAudienceSchema, async (data) => {
	await requireStaff();

	const baseSlug = data.slug || generateSlug(data.name);
	const slug = await ensureUniqueSlug(baseSlug, audience, audience.slug);

	const created = await createAudience({
		name: data.name,
		slug,
		description: data.description,
		allowOptIn: data.allowOptIn
	});

	void getAudiences().refresh();
	return { audienceId: created.id };
});
