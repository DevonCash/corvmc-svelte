import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { AudienceDetailResponse } from '$lib/types/api';

export const load: PageLoad = async ({ fetch, params }) => {
	const res = await fetch(`/api/marketing/audiences/${params.slug}`);
	if (!res.ok) throw error(res.status, 'List not found');
	return (await res.json()) as AudienceDetailResponse;
};
