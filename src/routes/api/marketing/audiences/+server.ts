import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getOptInAudiences, createAudience } from '$lib/server/marketing/audience-service';
import { requireStaffRole } from '$lib/server/authorization';
import { generateSlug, ensureUniqueSlug } from '$lib/server/utils/slug';
import { audience } from '$lib/server/db/schema/marketing';

export const GET: RequestHandler = async () => {
	const audiences = await getOptInAudiences();
	return json({ audiences });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	await requireStaffRole(locals.user?.id);

	const body = (await request.json()) as {
		name?: string;
		slug?: string;
		description?: string;
		allowOptIn?: boolean;
	};

	if (!body.name) throw error(400, 'Name is required');

	const baseSlug = body.slug || generateSlug(body.name);
	const slug = await ensureUniqueSlug(baseSlug, audience, audience.slug);

	const created = await createAudience({
		name: body.name,
		slug,
		description: body.description,
		allowOptIn: body.allowOptIn ?? false
	});

	return json({ audienceId: created.id });
};
