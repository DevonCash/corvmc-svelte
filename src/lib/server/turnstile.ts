import { env } from '$env/dynamic/private';
import { captureException } from '$lib/server/sentry';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// Cloudflare's documented "always passes" test secret. Used when no real secret
// is configured (local dev, CI, tests) so verification succeeds without a key.
// https://developers.cloudflare.com/turnstile/troubleshooting/testing/
const TURNSTILE_TEST_SECRET = '1x0000000000000000000000000000000AA';

interface SiteVerifyResponse {
	success: boolean;
	'error-codes'?: string[];
}

/**
 * Verify a Cloudflare Turnstile token against the siteverify endpoint.
 * Returns false (never throws) on a missing token, network error, or rejection,
 * so callers can treat the result as a simple pass/fail gate.
 */
export async function verifyTurnstile(
	token: string | undefined | null,
	remoteIp?: string | null
): Promise<boolean> {
	if (!token) return false;

	const secret = env.TURNSTILE_SECRET_KEY || TURNSTILE_TEST_SECRET;

	const body = new FormData();
	body.append('secret', secret);
	body.append('response', token);
	if (remoteIp) body.append('remoteip', remoteIp);

	try {
		const res = await fetch(SITEVERIFY_URL, { method: 'POST', body });
		if (!res.ok) {
			captureException(new Error(`turnstile: siteverify returned ${res.status}`), {
				event: 'turnstile.verify',
				stage: 'http_error',
				status: res.status
			});
			return false;
		}
		const data = (await res.json()) as SiteVerifyResponse;
		return data.success === true;
	} catch (err) {
		captureException(err, { event: 'turnstile.verify', stage: 'request' });
		return false;
	}
}
