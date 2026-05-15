import { error, json } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getAudienceBySlug, addSubscriber } from '$lib/server/marketing/audience-service';
import { findOrCreateByEmail } from '$lib/server/marketing/subscriber-service';

export const load: PageServerLoad = async ({ params }) => {
	const audience = await getAudienceBySlug(params.slug);
	if (!audience || !audience.allowOptIn) throw error(404, 'List not found');

	return {
		audience: {
			id: audience.id,
			name: audience.name,
			slug: audience.slug,
			description: audience.description
		}
	};
};

export const POST = async ({ params, request }) => {
	const audience = await getAudienceBySlug(params.slug);
	if (!audience || !audience.allowOptIn) throw error(404, 'List not found');

	const body = await request.json();
	const email = body.email?.trim()?.toLowerCase();
	if (!email) throw error(400, 'Email is required');

	const sub = await findOrCreateByEmail(email, body.name?.trim());
	await addSubscriber(audience.id, sub.id);

	return json({ success: true });
};
