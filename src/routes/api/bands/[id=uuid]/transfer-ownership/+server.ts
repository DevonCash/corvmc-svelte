import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { requireStaffRole } from '$lib/server/authorization';
import { getByIdWithDetails, transferOwnership } from '$lib/server/band/band-service';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	await requireStaffRole(locals.user?.id);
	const { newOwnerId } = (await request.json()) as { newOwnerId?: string };
	if (!newOwnerId) return json({ error: 'newOwnerId required' }, { status: 400 });
	const band = await getByIdWithDetails(params.id);
	if (!band) throw error(404, 'Band not found');
	await transferOwnership(params.id, newOwnerId, band.ownerId);
	return json({ success: true });
};
