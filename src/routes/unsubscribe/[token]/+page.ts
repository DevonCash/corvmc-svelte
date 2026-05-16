import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params }) => {
	const res = await fetch(`/api/marketing/unsubscribe/${params.token}`);
	return await res.json();
};
