import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listForUser } from '$lib/server/band/band-service';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) return redirect(302, '/demo/better-auth/login');

	const bands = await listForUser(locals.user.id);

	return {
		pending: bands.filter((b) => b.status === 'pending'),
		active: bands.filter((b) => b.status === 'active')
	};
};
