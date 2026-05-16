import type { LayoutLoad } from './$types';
import type { AuthMeResponse } from '$lib/types/api';

export const load: LayoutLoad = async ({ fetch }) => {
	const data = (await fetch('/api/auth/me').then((r) => r.json())) as AuthMeResponse;
	return { user: data.user };
};
