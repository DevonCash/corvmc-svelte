/**
 * Slugs that can never be claimed as a band subdomain ({slug}.corvmc.org).
 * Used by the reroute hook (to leave system subdomains alone) and by band
 * slug generation (so no band ever claims one). Universal module — safe to
 * import from both client and server code.
 */
export const RESERVED_SLUGS = new Set([
	// System subdomains (media = R2 public bucket)
	'www',
	'api',
	'mail',
	'email',
	'smtp',
	'imap',
	'staging',
	'dev',
	'test',
	'preview',
	'media',
	'cdn',
	'assets',
	'static',
	'status',
	// App areas and generic names bands shouldn't squat
	'admin',
	'staff',
	'member',
	'members',
	'band',
	'bands',
	'band-site',
	'login',
	'logout',
	'signup',
	'register',
	'auth',
	'account',
	'app',
	'events',
	'directory',
	'help',
	'support',
	'docs',
	'blog',
	'news',
	'shop',
	'store',
	'donate',
	'corvmc',
	'cmc'
]);

export function isReservedSlug(slug: string): boolean {
	return RESERVED_SLUGS.has(slug.toLowerCase());
}
