import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params, url }) => {
	const res = await fetch(`/api/events/${params.id}/tickets/success` + url.search);
	if (!res.ok) throw error(res.status, 'Purchase not found');
	return await res.json();
};
