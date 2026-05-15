import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { listForUser } from '$lib/server/band/band-service';
import { hasAnyRole } from '$lib/server/authorization';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return redirect(302, '/demo/better-auth/login');
	}

	return {
		user: locals.user,
		userBands: await listForUser(locals.user.id).catch(() => []),
		isStaff: await hasAnyRole(locals.user.id, ['admin', 'staff'])
	};
};
