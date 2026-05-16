import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { ReservationPayResponse } from '$lib/types/api';

export const load: PageLoad = async ({ params, fetch }) => {
	const res = await fetch(`/api/me/reservations/${params.id}/pay`);
	if (res.status === 401) redirect(302, '/login');
	return (await res.json()) as ReservationPayResponse;
};
