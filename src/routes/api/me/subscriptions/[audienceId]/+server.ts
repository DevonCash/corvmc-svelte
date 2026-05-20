import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import {
	addSubscriber,
	unsubscribe
} from '$lib/server/marketing/audience-service';
import { findOrCreateForUser, findByUserId } from '$lib/server/marketing/subscriber-service';

export const POST: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Not authenticated');
	const sub = await findOrCreateForUser(locals.user.id, locals.user.email, locals.user.name);
	await addSubscriber(params.audienceId, sub.id);
	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Not authenticated');
	const sub = await findByUserId(locals.user.id);
	if (sub) {
		await unsubscribe(sub.id, params.audienceId);
	}
	return json({ success: true });
};
