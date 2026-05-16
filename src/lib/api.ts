import { redirect, error } from '@sveltejs/kit';

/**
 * Fetch from an internal API route with standard error handling.
 * Redirects to login on 401, throws SvelteKit errors for other failures.
 */
export async function apiFetch<T = unknown>(
	fetch: typeof globalThis.fetch,
	path: string,
	opts?: RequestInit
): Promise<T> {
	const res = await fetch(path, opts);

	if (res.status === 401) {
		redirect(302, '/login');
	}

	if (!res.ok) {
		const text = await res.text().catch(() => res.statusText);
		error(res.status, text);
	}

	return res.json();
}
