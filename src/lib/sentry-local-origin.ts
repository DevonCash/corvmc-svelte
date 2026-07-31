/**
 * Shared localhost guard for both Sentry init sites (hooks.client.ts and
 * hooks.server.ts).
 *
 * The `enabled` flags in those files gate reporting on
 * `SENTRY_ENVIRONMENT`/`PUBLIC_SENTRY_ENVIRONMENT` being `ci`, which
 * playwright.config.ts sets. That guard fails open: `reuseExistingServer` means
 * a `vite preview` started by hand (or left running by an earlier session on
 * another worktree) is reused by Playwright without those env vars, so the whole
 * e2e run reports to production Sentry as `environment: production`. That is
 * where JAVASCRIPT-SVELTEKIT-1V/1W/1X/1Y/1Z came from — several of them against
 * a stale build whose bugs were already fixed on main.
 *
 * Checking the origin instead is belt-and-braces over the env var: it holds no
 * matter how the server was started. Deliberately no Sentry import here so the
 * module stays usable from the Workers-bundled server hook (see
 * src/lib/server/sentry.ts for why carrier alignment matters).
 */

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);

/**
 * True when `url` points at a local development or preview server. Subdomains of
 * `.localhost` count too — band sites are served per-subdomain, so local runs
 * hit hostnames like `some-band.localhost`.
 *
 * Unparseable or missing URLs return false: when in doubt, let the event through
 * rather than silently dropping a real production error.
 */
export function isLocalOrigin(url: string | undefined | null): boolean {
	if (!url) return false;
	let hostname: string;
	try {
		hostname = new URL(url).hostname;
	} catch {
		return false;
	}
	return LOCAL_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost');
}
