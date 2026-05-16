import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ fetch }) => {
	const res = await fetch('/api/staff/layout');
	if (res.status === 401) redirect(302, '/demo/better-auth/login');
	if (res.status === 403) redirect(302, '/');
	return await res.json();
};
