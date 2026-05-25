import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBySlug, getMembers } from '$lib/server/band/band-service';
import type { BandMembersResponse } from '$lib/server/db/schema/api';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) return error(401, 'Not authenticated');

	const band = await getBySlug(params.slug);
	if (!band) return error(404, 'Band not found');

	const members = await getMembers(band.id);

	return json({
		active: members.filter((m) => m.status === 'active'),
		pending: members.filter((m) => m.status === 'pending')
	} satisfies BandMembersResponse);
};
