import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params }) => {
	const res = await fetch(`/api/staff/events/${params.id}/check-in`);
	return await res.json();
};
