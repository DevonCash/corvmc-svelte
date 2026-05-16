import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params }) => {
	const res = await fetch(`/api/staff/reservations/${params.id}`);
	return await res.json();
};
