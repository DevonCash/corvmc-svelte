import type { PageLoad } from './$types';
import type { EventsResponse } from '$lib/server/db/schema/api';

export const load: PageLoad = async ({ fetch }) => {
	const res = await fetch('/api/events');
	return (await res.json()) as EventsResponse;
};
