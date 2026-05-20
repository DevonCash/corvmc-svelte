import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireStaffRole } from '$lib/server/authorization';
import { create } from '$lib/server/band/band-service';

export const POST: RequestHandler = async ({ request, locals }) => {
	await requireStaffRole(locals.user?.id);
	const { name, bio, ownerId } = (await request.json()) as { name?: string; bio?: string; ownerId?: string };
	if (!name || !ownerId) return json({ error: 'Name and owner required' }, { status: 400 });
	const band = await create(ownerId, { name, bio });
	return json({ bandId: band.id });
};
