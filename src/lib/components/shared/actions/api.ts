/**
 * Shared fetch wrapper for action components.
 * Sends a JSON POST/DELETE to an API route and returns the parsed response.
 * Throws on non-2xx with the server error message.
 */
export async function actionFetch(
	url: string,
	options: { method?: string; body?: Record<string, unknown> } = {}
): Promise<unknown> {
	const { method = 'POST', body } = options;
	const res = await fetch(url, {
		method,
		headers: body ? { 'Content-Type': 'application/json' } : undefined,
		body: body ? JSON.stringify(body) : undefined
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
	return data;
}
