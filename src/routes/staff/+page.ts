import type { PageLoad } from './$types';
import type { StaffDashboardResponse } from '$lib/server/db/schema/api';

export const load: PageLoad = async ({ fetch }) => {
	const res = await fetch('/api/staff/dashboard');
	return (await res.json()) as StaffDashboardResponse;
};
