import type { PageLoad } from './$types';
import type { EventsResponse } from '$lib/types/api';

export const load: PageLoad = async ({ fetch }) => {
	const res = await fetch('/api/events');
	return (await res.json()) as EventsResponse;
};
