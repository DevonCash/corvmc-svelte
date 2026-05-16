import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { resume } from '$lib/server/finance/subscription-service';

export const POST: RequestHandler = async ({ locals }) => {
	if (!locals.user) return json({ error: 'Not authenticated' }, { status: 401 });
	const user = locals.user;
	if (!user.stripeId) {
		return json({ error: 'No billing account found.' }, { status: 400 });
	}

	try {
		await resume(user.stripeId);
		return json({ success: true });
	} catch (e) {
		return json({ error: (e as Error).message }, { status: 500 });
	}
};
