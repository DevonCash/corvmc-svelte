import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listForUser } from '$lib/server/band/band-service';
import type { MemberBandsResponse } from '$lib/server/db/schema/api';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) return error(401, 'Not authenticated');

	const bands = await listForUser(locals.user.id);

	const serialize = (b: (typeof bands)[number]) => ({
		id: b.id,
		name: b.name,
		slug: b.slug,
		avatarKey: b.avatarKey,
		role: b.role,
		status: b.status,
		memberCount: b.memberCount
	});

	return json({
		pending: bands.filter((b) => b.status === 'pending').map(serialize),
		active: bands.filter((b) => b.status === 'active').map(serialize)
	} satisfies MemberBandsResponse);
};
