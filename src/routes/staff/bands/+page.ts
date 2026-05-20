import type { PageLoad } from './$types';
import type { StaffBandsResponse } from '$lib/server/db/schema/api';

export const load: PageLoad = async ({ fetch, url }) => {
	const res = await fetch('/api/staff/bands' + url.search);
	return (await res.json()) as StaffBandsResponse;
};
