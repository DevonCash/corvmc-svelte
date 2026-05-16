import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params }) => {
	const res = await fetch(`/api/marketing/audiences/${params.slug}`);
	if (!res.ok) throw error(res.status, 'List not found');
	return await res.json();
};
