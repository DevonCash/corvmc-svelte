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

/**
 * Extract a human-readable message from a failed API Response. SvelteKit's
 * `error(status, message)` responds with a JSON `{ message }` body; fall back to
 * the provided default when the body isn't JSON or has no message.
 */
export async function responseErrorMessage(res: Response, fallback: string): Promise<string> {
	try {
		const body = (await res.json()) as { message?: unknown };
		if (typeof body?.message === 'string' && body.message) return body.message;
	} catch {
		// body wasn't JSON — use the fallback
	}
	return fallback;
}
