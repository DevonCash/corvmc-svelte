import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
	const res = await fetch('/api/me/membership');
	if (res.status === 401) redirect(302, '/demo/better-auth/login');
	return await res.json();
};
