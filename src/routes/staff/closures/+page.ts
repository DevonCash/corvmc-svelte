import type { PageLoad } from './$types';
import type { StaffClosuresResponse } from '$lib/types/api';

export const load: PageLoad = async ({ fetch }) => {
	const res = await fetch('/api/staff/closures');
	return (await res.json()) as StaffClosuresResponse;
};
