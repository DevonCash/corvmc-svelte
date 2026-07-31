/**
 * Build an internal link for a band site page that works in all three serving
 * modes:
 *  - real band subdomain ({slug}.corvmc.org): plain root-relative paths
 *  - dev override (?__band_subdomain=slug on localhost): keep the query param
 *  - direct path-based access (/band-site/{slug}/...): keep the path prefix
 *
 * `path` is the band-site-relative path ('' for home, '/events', '/epk').
 */
/**
 * The domain band subdomains hang off ({slug}.<domain>), derived from
 * PUBLIC_SITE_URL so staging/preview deploys get their own namespace.
 */
export function baseDomainFromSiteUrl(siteUrl: string | undefined): string {
	if (siteUrl) {
		try {
			return new URL(siteUrl).hostname.replace(/^www\./, '');
		} catch {
			// fall through to the production default
		}
	}
	return 'corvmc.org';
}

/** The band-site-relative path ('/', '/events', …) of the current URL. */
export function bandSitePath(slug: string, currentUrl: URL): string {
	const prefix = `/band-site/${slug}`;
	if (currentUrl.pathname.startsWith(prefix)) {
		return currentUrl.pathname.slice(prefix.length) || '/';
	}
	return currentUrl.pathname;
}

export function bandSiteHref(slug: string, path: string, currentUrl: URL): string {
	const devOverride = currentUrl.searchParams.get('__band_subdomain');
	if (devOverride) {
		return `${path || '/'}?__band_subdomain=${encodeURIComponent(devOverride)}`;
	}
	if (currentUrl.pathname.startsWith('/band-site/')) {
		return `/band-site/${slug}${path}`;
	}
	return path || '/';
}
