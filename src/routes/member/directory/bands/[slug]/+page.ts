import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { DirectoryBandResponse } from '$lib/server/db/schema/api';

export const load: PageLoad = async ({ params, fetch }) => {
	const res = await fetch(`/api/me/directory/bands/${params.slug}`);
	if (res.status === 401) redirect(302, '/login');
	return (await res.json()) as DirectoryBandResponse;
};
