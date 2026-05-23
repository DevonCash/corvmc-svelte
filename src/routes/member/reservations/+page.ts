import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { MemberReservationsResponse } from '$lib/server/db/schema/api';

export const load: PageLoad = async ({ fetch, url }) => {
	const res = await fetch('/api/me/reservations');
	if (res.status === 401) redirect(302, '/login');
	const data = (await res.json()) as MemberReservationsResponse;
	return {
		...data,
		confirmId: url.searchParams.get('confirm')
	};
};
