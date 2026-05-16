import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBySlug, getMembers } from '$lib/server/band/band-service';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) return error(401, 'Not authenticated');

	const band = await getBySlug(params.slug);
	if (!band) return error(404, 'Band not found');

	const members = await getMembers(band.id);

	return json({
		active: members
			.filter((m) => m.status === 'active')
			.map((m) => ({
				id: m.id,
				userId: m.userId,
				role: m.role,
				position: m.position,
				userName: m.userName,
				userEmail: m.userEmail,
				createdAt: m.createdAt.toISOString()
			})),
		pending: members
			.filter((m) => m.status === 'pending')
			.map((m) => ({
				id: m.id,
				userId: m.userId,
				role: m.role,
				position: m.position,
				userName: m.userName,
				userEmail: m.userEmail,
				invitedById: m.invitedById,
				createdAt: m.createdAt.toISOString()
			}))
	});
};
