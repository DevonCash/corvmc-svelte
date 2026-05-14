import type { PageServerLoad } from './$types';
import { getMembers } from '$lib/server/band/band-service';

export const load: PageServerLoad = async ({ parent }) => {
	const { band } = await parent();

	const members = await getMembers(band.id);

	return {
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
	};
};
