import type { Reroute } from '@sveltejs/kit';
import { env } from '$env/dynamic/public';
import { isReservedSlug } from '$lib/reserved-slugs';
import { baseDomainFromSiteUrl } from '$lib/utils/band-site-url';

/**
 * Reroute subdomain requests to the band-site route group.
 * e.g. the-neons.corvmc.org/events → /band-site/the-neons/events
 */
export const reroute: Reroute = ({ url }) => {
	// In dev, we can't use real subdomains easily, so support a query param override:
	// http://localhost:5173?__band_subdomain=the-neons
	const devOverride = url.searchParams.get('__band_subdomain');
	if (devOverride) {
		return `/band-site/${devOverride}${url.pathname}`;
	}

	// Production: detect band subdomains. The base domain derives from
	// PUBLIC_SITE_URL so staging/preview deploys use their own domain.
	const baseDomain = baseDomainFromSiteUrl(env.PUBLIC_SITE_URL);
	const hostname = url.hostname;

	if (
		hostname !== baseDomain &&
		hostname !== `www.${baseDomain}` &&
		hostname.endsWith(`.${baseDomain}`)
	) {
		const slug = hostname.slice(0, -(baseDomain.length + 1));
		// Don't reroute system subdomains (e.g. media = R2 public bucket)
		if (slug.includes('.') || isReservedSlug(slug)) {
			return url.pathname;
		}
		return `/band-site/${slug}${url.pathname}`;
	}

	return url.pathname;
};
