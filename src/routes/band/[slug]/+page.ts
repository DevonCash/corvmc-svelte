import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { BandUpcomingResponse } from '$lib/types/api';

export const load: PageLoad = async ({ fetch, params }) => {
	const res = await fetch(`/api/bands/${params.slug}/reservations/upcoming`);

	if (!res.ok) error(res.status, await res.text());

	return (await res.json()) as BandUpcomingResponse;
};
