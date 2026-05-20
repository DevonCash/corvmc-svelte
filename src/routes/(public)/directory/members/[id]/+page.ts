import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { DirectoryMemberResponse } from '$lib/server/db/schema/api';

export const load: PageLoad = async ({ fetch, params }) => {
	const res = await fetch(`/api/directory/members/${params.id}`);
	if (!res.ok) throw error(res.status, 'Member not found');
	return (await res.json()) as DirectoryMemberResponse;
};
