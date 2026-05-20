import type { PageLoad } from './$types';
import type { StaffCreditsResponse } from '$lib/server/db/schema/api';

export const load: PageLoad = async ({ fetch, url }) => {
	const res = await fetch('/api/staff/credits' + url.search);
	return (await res.json()) as StaffCreditsResponse;
};
