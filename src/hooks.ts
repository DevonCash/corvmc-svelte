import type { Reroute } from '@sveltejs/kit';

/**
 * Reroute subdomain requests to the band-site route group.
 * e.g. the-neons.corvmc.com/events → /band-site/the-neons/events
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
	// BASE_DOMAIN should match the production domain (e.g. corvmc.com)
	const BASE_DOMAIN = 'corvmc.com';

	if (
		hostname !== BASE_DOMAIN &&
		hostname !== `www.${BASE_DOMAIN}` &&
		hostname.endsWith(`.${BASE_DOMAIN}`)
	) {
		const slug = hostname.replace(`.${BASE_DOMAIN}`, '');
		// Don't reroute known system subdomains
		if (['www', 'api', 'mail', 'staging'].includes(slug)) {
			return url.pathname;
		}
		return `/band-site/${slug}${url.pathname}`;
	}

	return url.pathname;
};
