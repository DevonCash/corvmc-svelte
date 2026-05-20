import type { PageLoad } from './$types';
import type { StaffPaymentsResponse } from '$lib/server/db/schema/api';

export const load: PageLoad = async ({ fetch, url }) => {
	const res = await fetch('/api/staff/payments' + url.search);
	return (await res.json()) as StaffPaymentsResponse;
};
