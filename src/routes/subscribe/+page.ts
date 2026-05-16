import type { PageLoad } from './$types';
import type { AudiencesResponse } from '$lib/types/api';

export const load: PageLoad = async ({ fetch }) => {
	const res = await fetch('/api/marketing/audiences');
	return (await res.json()) as AudiencesResponse;
};
