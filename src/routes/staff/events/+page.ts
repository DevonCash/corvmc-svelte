import type { PageLoad } from './$types';
import type { StaffEventsResponse } from '$lib/server/db/schema/api';

export const load: PageLoad = async ({ fetch }) => {
	const res = await fetch('/api/staff/events');
	return (await res.json()) as StaffEventsResponse;
};
