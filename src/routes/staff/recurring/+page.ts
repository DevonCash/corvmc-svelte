import type { PageLoad } from './$types';
import type { StaffRecurringResponse } from '$lib/server/db/schema/api';

export const load: PageLoad = async ({ fetch, url }) => {
	const res = await fetch('/api/staff/recurring' + url.search);
	return (await res.json()) as StaffRecurringResponse;
};
