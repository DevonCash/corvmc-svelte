import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getBySlug, getUserRole, listForUser } from '$lib/server/band/band-service';
import { hasAnyRole } from '$lib/server/authorization';

export const load: LayoutServerLoad = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Not authenticated');

	const band = await getBySlug(params.slug);
	if (!band) throw error(404, 'Band not found');

	// Check membership or staff/admin access
	const [role, isStaff] = await Promise.all([
		getUserRole(band.id, locals.user.id),
		hasAnyRole(locals.user.id, ['admin', 'staff'])
	]);

	if (!role && !isStaff) {
		throw error(403, 'You are not a member of this band');
	}

	return {
		band: {
			id: band.id,
			name: band.name,
			slug: band.slug,
			bio: band.bio,
			ownerId: band.ownerId,
			avatarKey: band.avatarKey,
			memberCount: band.memberCount,
			createdAt: band.createdAt.toISOString()
		},
		userRole: role ?? ('staff' as const),
		isStaff,
		userBands: await listForUser(locals.user.id).catch(() => [])
	};
};
