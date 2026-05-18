import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params }) => {
	const res = await fetch(`/api/events/${params.id}`);
	if (!res.ok) throw error(res.status, 'Event not found');
	return await res.json();
};
