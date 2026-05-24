import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { AuthMeResponse } from '$lib/server/db/schema/api';

export const GET: RequestHandler = async ({ locals }) => {
	const user = locals.user;
	return json({
		user: user
			? { id: user.id, name: user.name, email: user.email, image: user.image ?? null }
			: null
	} satisfies AuthMeResponse);
};
