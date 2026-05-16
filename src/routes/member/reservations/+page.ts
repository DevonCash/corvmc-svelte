import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { MemberReservationsResponse } from '$lib/types/api';

export const load: PageLoad = async ({ fetch }) => {
	const res = await fetch('/api/me/reservations');
	if (res.status === 401) redirect(302, '/demo/better-auth/login');
	return (await res.json()) as MemberReservationsResponse;
};
