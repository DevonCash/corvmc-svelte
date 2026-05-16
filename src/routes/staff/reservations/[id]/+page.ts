import type { PageLoad } from './$types';
import type { StaffReservationDetailResponse } from '$lib/types/api';

export const load: PageLoad = async ({ fetch, params }) => {
	const res = await fetch(`/api/staff/reservations/${params.id}`);
	return (await res.json()) as StaffReservationDetailResponse;
};
