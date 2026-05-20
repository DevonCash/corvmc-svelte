import { error, redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';
import type { BandLayoutResponse } from '$lib/server/db/schema/api';

export const load: LayoutLoad = async ({ fetch, params }) => {
	const res = await fetch(`/api/bands/${params.slug}/layout`);

	if (res.status === 401) redirect(302, '/login');
	if (res.status === 404) error(404, 'Band not found');
	if (res.status === 403) error(403, 'You are not a member of this band');
	if (!res.ok) error(res.status, await res.text());

	return (await res.json()) as BandLayoutResponse;
};
