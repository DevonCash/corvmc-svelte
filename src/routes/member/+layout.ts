import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ fetch }) => {
	const res = await fetch('/api/me/layout');
	if (res.status === 401) redirect(302, '/demo/better-auth/login');
	return await res.json();
};
