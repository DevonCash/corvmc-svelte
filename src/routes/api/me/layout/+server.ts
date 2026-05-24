import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listForUser } from '$lib/server/band/band-service';
import { hasAnyRole } from '$lib/server/authorization';
import type { MemberLayoutResponse } from '$lib/server/db/schema/api';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) return error(401, 'Not authenticated');
	const user = locals.user;

	const [userBands, isStaff] = await Promise.all([
		listForUser(user.id).catch(() => []),
		hasAnyRole(user.id, ['admin', 'staff'])
	]);

	return json({
		user: { id: user.id, name: user.name, email: user.email },
		userBands: userBands.map((b) => ({
			id: b.id,
			name: b.name,
			slug: b.slug,
			avatarKey: b.avatarKey,
			role: b.role
		})),
		isStaff
	} satisfies MemberLayoutResponse);
};
