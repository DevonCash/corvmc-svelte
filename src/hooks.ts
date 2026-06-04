import type { Reroute } from '@sveltejs/kit';

/**
 * Reroute subdomain requests to the band-site route group.
 * e.g. the-neons.corvmc.org/events → /band-site/the-neons/events
 */
export const reroute: Reroute = ({ url }) => {
	const hostname = url.hostname;

	// In dev, we can't use real subdomains easily, so support a query param override:
	// http://localhost:5173?__band_subdomain=the-neons
	const devOverride = url.searchParams.get('__band_subdomain');
	if (devOverride) {
		return `/band-site/${devOverride}${url.pathname}`;
	}

	// Production: detect band subdomains
	// BASE_DOMAIN should match the production domain (e.g. corvmc.org)
	const BASE_DOMAIN = 'corvmc.org';

	if (
		hostname !== BASE_DOMAIN &&
		hostname !== `www.${BASE_DOMAIN}` &&
		hostname.endsWith(`.${BASE_DOMAIN}`)
	) {
		const slug = hostname.replace(`.${BASE_DOMAIN}`, '');
		// Don't reroute known system subdomains (media = R2 public bucket)
		if (['www', 'api', 'mail', 'staging', 'media'].includes(slug)) {
			return url.pathname;
		}
		return `/band-site/${slug}${url.pathname}`;
	}

	return url.pathname;
};
