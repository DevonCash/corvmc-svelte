import type { PageLoad } from './$types';
import type { UnsubscribeResponse } from '$lib/server/db/schema/api';

export const load: PageLoad = async ({ fetch, params }) => {
	const res = await fetch(`/api/marketing/unsubscribe/${params.token}`);
	return (await res.json()) as UnsubscribeResponse;
};
