import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';
import type { MemberLayoutResponse } from '$lib/types/api';

export const load: LayoutLoad = async ({ fetch }) => {
	const res = await fetch('/api/me/layout');
	if (res.status === 401) redirect(302, '/login');
	return (await res.json()) as MemberLayoutResponse;
};
