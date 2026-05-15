import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { listForUser } from '$lib/server/band/band-service';
import { hasAnyRole } from '$lib/server/authorization';
import { band, bandMember } from '$lib/server/db/schema/band';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return redirect(302, '/demo/better-auth/login');
	}

	return {
		user: locals.user,
		userBands: await listForUser(locals.user.id, {
			id: band.id,
			name: band.name,
			avatarKey: band.avatarKey
		}),
		isStaff: await hasAnyRole(locals.user.id, ['admin', 'staff'])
	};
};
