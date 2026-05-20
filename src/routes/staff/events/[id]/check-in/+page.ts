import type { PageLoad } from './$types';
import type { StaffCheckInResponse } from '$lib/server/db/schema/api';

export const load: PageLoad = async ({ fetch, params }) => {
	const res = await fetch(`/api/staff/events/${params.id}/check-in`);
	return (await res.json()) as StaffCheckInResponse;
};
