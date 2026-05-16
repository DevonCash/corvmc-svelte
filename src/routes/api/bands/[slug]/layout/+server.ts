import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBySlug, getUserRole, listForUser } from '$lib/server/band/band-service';
import { hasAnyRole } from '$lib/server/authorization';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) return error(401, 'Not authenticated');

	const band = await getBySlug(params.slug);
	if (!band) return error(404, 'Band not found');

	const [role, isStaff] = await Promise.all([
		getUserRole(band.id, locals.user.id),
		hasAnyRole(locals.user.id, ['admin', 'staff'])
	]);

	if (!role && !isStaff) {
		return error(403, 'You are not a member of this band');
	}

	return json({
		band: {
			id: band.id,
			name: band.name,
			slug: band.slug,
			bio: band.bio,
			ownerId: band.ownerId,
			avatarKey: band.avatarKey,
			memberCount: band.memberCount,
			createdAt: band.createdAt
		},
		userRole: role ?? 'staff',
		isStaff,
		userBands: await listForUser(locals.user.id).catch(() => [])
	});
};
