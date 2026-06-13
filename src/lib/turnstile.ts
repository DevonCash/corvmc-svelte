import { env } from '$env/dynamic/public';

// Cloudflare's documented "always passes" test site key. Used when no real key
// is configured (local dev, CI, tests) so the widget renders and auto-solves.
// https://developers.cloudflare.com/turnstile/troubleshooting/testing/
export const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';

/** Public Turnstile site key for the client widget; falls back to the test key. */
export const TURNSTILE_SITE_KEY = env.PUBLIC_TURNSTILE_SITE_KEY || TURNSTILE_TEST_SITE_KEY;

// Name of the hidden input the widget renders into each form. We override the
// library default ('cf-turnstile-response') with a valid identifier so it can be
// a Zod schema key and a SvelteKit `issue.<field>()` path (which rejects hyphens).
export const TURNSTILE_RESPONSE_FIELD = 'turnstileToken';
