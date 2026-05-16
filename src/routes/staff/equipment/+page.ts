import type { PageLoad } from './$types';
import type { StaffEquipmentResponse } from '$lib/types/api';

export const load: PageLoad = async ({ fetch, url }) => {
	const res = await fetch('/api/staff/equipment' + url.search);
	return (await res.json()) as StaffEquipmentResponse;
};
