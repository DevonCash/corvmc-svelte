import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params }) => {
	const res = await fetch(`/api/directory/members/${params.id}`);
	if (!res.ok) throw error(res.status, 'Member not found');
	return await res.json();
};
