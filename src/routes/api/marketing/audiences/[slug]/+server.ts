import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAudienceBySlug, addSubscriber } from '$lib/server/marketing/audience-service';
import { findOrCreateByEmail } from '$lib/server/marketing/subscriber-service';
import type { AudienceDetailResponse } from '$lib/server/db/schema/api';

export const GET: RequestHandler = async ({ params }) => {
	const audience = await getAudienceBySlug(params.slug);
	if (!audience || !audience.allowOptIn) throw error(404, 'List not found');

	return json({
		audience: {
			id: audience.id,
			name: audience.name,
			slug: audience.slug,
			description: audience.description
		},
		isSubscribed: false
	} satisfies AudienceDetailResponse);
};

export const POST: RequestHandler = async ({ params, request }) => {
	const audience = await getAudienceBySlug(params.slug);
	if (!audience || !audience.allowOptIn) throw error(404, 'List not found');

	const body = await request.json() as { email?: string; name?: string };
	const email = body.email?.trim()?.toLowerCase();
	if (!email) throw error(400, 'Email is required');

	const sub = await findOrCreateByEmail(email, body.name?.trim());
	await addSubscriber(audience.id, sub.id);

	return json({ success: true });
};
