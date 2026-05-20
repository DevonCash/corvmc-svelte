import type { PageLoad } from './$types';
import type { StaffReservationsResponse } from '$lib/server/db/schema/api';

export const load: PageLoad = async ({ fetch, url }) => {
	const res = await fetch('/api/staff/reservations' + url.search);
	return (await res.json()) as StaffReservationsResponse;
};
