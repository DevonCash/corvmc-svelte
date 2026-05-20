import type { PageLoad } from './$types';
import type { StaffEquipmentLoansResponse } from '$lib/server/db/schema/api';

export const load: PageLoad = async ({ fetch, url }) => {
	const res = await fetch('/api/staff/equipment/loans' + url.search);
	return (await res.json()) as StaffEquipmentLoansResponse;
};
