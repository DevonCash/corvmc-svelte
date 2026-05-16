import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getOptInAudiences } from '$lib/server/marketing/audience-service';

export const GET: RequestHandler = async () => {
	const audiences = await getOptInAudiences();
	return json({ audiences });
};
