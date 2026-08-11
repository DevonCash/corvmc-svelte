import { error, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/public';
import { bandSiteUrl } from '$lib/utils/band-site-url';
import { requireFeature } from '$lib/server/feature-flags';
import { db } from '$lib/server/db';
import { band } from '$lib/server/db/schema/band';
import { eq, and, isNull } from 'drizzle-orm';

// Served on band subdomains: {slug}.corvmc.org/robots.txt reroutes here.
export const GET: RequestHandler = async ({ params }) => {
	await requireFeature('bandPremium');

	const [row] = await db
		.select({ tier: band.tier, customDomain: band.customDomain, status: band.customDomainStatus })
		.from(band)
		.where(and(eq(band.slug, params.slug!), isNull(band.deletedAt)))
		.limit(1);
	if (!row || row.tier !== 'premium') throw error(404, 'Not found');

	const origin = bandSiteUrl(
		params.slug!,
		env.PUBLIC_SITE_URL,
		row.status === 'active' ? row.customDomain : null
	);
	const body = ['User-agent: *', 'Allow: /', `Sitemap: ${origin}/sitemap.xml`, ''].join('\n');

	return new Response(body, {
		headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'public, max-age=3600' }
	});
};
