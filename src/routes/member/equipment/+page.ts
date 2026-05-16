import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { MemberEquipmentResponse } from '$lib/types/api';

export const load: PageLoad = async ({ fetch, url }) => {
	const res = await fetch('/api/me/equipment' + url.search);
	if (res.status === 401) redirect(302, '/login');
	return (await res.json()) as MemberEquipmentResponse;
};
