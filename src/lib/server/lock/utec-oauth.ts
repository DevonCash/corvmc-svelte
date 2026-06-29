// Shared constants for the U-tec OAuth flow (kept out of +server.ts files,
// which may only export HTTP method handlers).

/** Cookie holding the CSRF state between authorize and callback. */
export const STATE_COOKIE = 'utec_oauth_state';
