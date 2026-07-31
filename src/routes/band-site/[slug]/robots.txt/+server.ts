import { error, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/public';
import { baseDomainFromSiteUrl } from '$lib/utils/band-site-url';
import { requireFeature } from '$lib/server/feature-flags';
import { db } from '$lib/server/db';
import { band } from '$lib/server/db/schema/band';
import { eq, and, isNull } from 'drizzle-orm';

// Served on band subdomains: {slug}.corvmc.org/robots.txt reroutes here.
export const GET: RequestHandler = async ({ params }) => {
	await requireFeature('bandPremium');

	const [row] = await db
		.select({ tier: band.tier })
		.from(band)
		.where(and(eq(band.slug, params.slug!), isNull(band.deletedAt)))
		.limit(1);
	if (!row || row.tier !== 'premium') throw error(404, 'Not found');

	const baseDomain = baseDomainFromSiteUrl(env.PUBLIC_SITE_URL);
	const body = [
		'User-agent: *',
		'Allow: /',
		`Sitemap: https://${params.slug}.${baseDomain}/sitemap.xml`,
		''
	].join('\n');

	return new Response(body, {
		headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'public, max-age=3600' }
	});
};
