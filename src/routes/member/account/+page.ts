import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { AccountResponse } from '$lib/server/db/schema/api';

export const load: PageLoad = async ({ fetch }) => {
	const res = await fetch('/api/me/account');
	if (res.status === 401) redirect(302, '/login');
	return (await res.json()) as AccountResponse;
};
