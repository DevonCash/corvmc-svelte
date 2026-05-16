import type { PageLoad } from './$types';
import type { StaffUsersResponse } from '$lib/types/api';

export const load: PageLoad = async ({ fetch, url }) => {
	const res = await fetch('/api/staff/users' + url.search);
	return (await res.json()) as StaffUsersResponse;
};
