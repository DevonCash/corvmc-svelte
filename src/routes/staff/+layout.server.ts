import { redirect } from '@sveltejs/kit';
import { hasAnyRole } from '$lib/server/authorization';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	if (!event.locals.user) {
		return redirect(302, '/demo/better-auth/login');
	}

	const allowed = await hasAnyRole(event.locals.user.id, ['admin', 'staff']);

	if (!allowed) {
		return redirect(302, '/');
	}

	return {
		user: event.locals.user
	};
};
