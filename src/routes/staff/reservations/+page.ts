import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url }) => {
	const res = await fetch('/api/staff/reservations' + url.search);
	return await res.json();
};
