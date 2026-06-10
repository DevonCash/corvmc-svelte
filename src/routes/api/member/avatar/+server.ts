import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { setUserAvatar, clearUserAvatar } from '$lib/server/directory/profile-service';

// ---------------------------------------------------------------------------
// POST — upload the current user's avatar
// ---------------------------------------------------------------------------

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) throw error(401, 'Not authenticated');

	const formData = await request.formData();
	const file = formData.get('file') as File | null;

	if (!file || !(file instanceof File)) {
		throw error(400, 'No file provided');
	}

	const key = await setUserAvatar(locals.user.id, await file.arrayBuffer(), file.type);

	return json({ success: true, avatarKey: key });
};

// ---------------------------------------------------------------------------
// DELETE — remove the current user's avatar
// ---------------------------------------------------------------------------

export const DELETE: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Not authenticated');

	await clearUserAvatar(locals.user.id);

	return json({ success: true });
};
