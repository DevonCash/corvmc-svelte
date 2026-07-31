import { getJson, putJson } from '$lib/server/kv';

/**
 * Soft KV-backed rate limit: allow at most `max` hits per `key` within
 * `ttlSeconds`. KV is eventually consistent, so this is a best-effort
 * throttle for abuse mitigation, not a hard guarantee — pair it with a
 * stronger gate (e.g. Turnstile) on public endpoints.
 *
 * Returns true when the hit is allowed. The TTL restarts on each hit, so a
 * steady stream of requests keeps the window open.
 */
export async function allowRateLimited(
	key: string,
	max: number,
	ttlSeconds: number
): Promise<boolean> {
	const kvKey = `rate-limit:${key}`;
	const count = (await getJson<number>(kvKey)) ?? 0;
	if (count >= max) return false;
	await putJson(kvKey, count + 1, Math.max(ttlSeconds, 60));
	return true;
}
