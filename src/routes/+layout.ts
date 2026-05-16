import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ fetch }) => {
	const data = await fetch('/api/auth/me').then((r) => r.json());
	return { user: data.user };
};
