import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { BandMembersResponse } from '$lib/server/db/schema/api';

export const load: PageLoad = async ({ fetch, params }) => {
	const res = await fetch(`/api/bands/${params.slug}/members`);

	if (!res.ok) error(res.status, await res.text());

	return (await res.json()) as BandMembersResponse;
};
