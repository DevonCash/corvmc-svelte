import type { LayoutLoad } from './$types';
import type { AuthMeResponse } from '$lib/types/api';

export const load: LayoutLoad = async ({ fetch }) => {
	try {
		const res = await fetch('/api/auth/me');
		if (!res.ok) return { user: null };
		const data = (await res.json()) as AuthMeResponse;
		return { user: data.user ?? null };
	} catch {
		return { user: null };
	}
};

