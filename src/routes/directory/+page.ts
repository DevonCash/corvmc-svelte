import type { PageLoad } from './$types';
import type { DirectoryResponse } from '$lib/types/api';

export const load: PageLoad = async ({ fetch, url }) => {
	const res = await fetch('/api/directory' + url.search);
	return (await res.json()) as DirectoryResponse;
};
