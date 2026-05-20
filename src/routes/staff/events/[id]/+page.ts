import type { PageLoad } from './$types';
import type { StaffEventDetailResponse } from '$lib/server/db/schema/api';

export const load: PageLoad = async ({ fetch, params }) => {
	const res = await fetch(`/api/staff/events/${params.id}`);
	return (await res.json()) as StaffEventDetailResponse;
};
