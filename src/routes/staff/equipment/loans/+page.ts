import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url }) => {
	const res = await fetch('/api/staff/equipment/loans' + url.search);
	return await res.json();
};
