import { error, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/public';
import { baseDomainFromSiteUrl } from '$lib/utils/band-site-url';
import { requireFeature } from '$lib/server/feature-flags';
import { db } from '$lib/server/db';
import { band } from '$lib/server/db/schema/band';
import { bandPageConfig } from '$lib/server/db/schema/band-page';
import { eq, and, isNull } from 'drizzle-orm';

// Served on band subdomains: {slug}.corvmc.org/sitemap.xml reroutes here.
export const GET: RequestHandler = async ({ params }) => {
	await requireFeature('bandPremium');

	const [row] = await db
		.select({ id: band.id, tier: band.tier, updatedAt: band.updatedAt })
		.from(band)
		.where(and(eq(band.slug, params.slug!), isNull(band.deletedAt)))
		.limit(1);
	if (!row || row.tier !== 'premium') throw error(404, 'Not found');

	const [config] = await db
		.select({ epk: bandPageConfig.epk })
		.from(bandPageConfig)
		.where(eq(bandPageConfig.bandId, row.id))
		.limit(1);

	const baseDomain = baseDomainFromSiteUrl(env.PUBLIC_SITE_URL);
	const origin = `https://${params.slug}.${baseDomain}`;
	const lastmod = row.updatedAt ? row.updatedAt.toISOString().slice(0, 10) : undefined;

	const paths = ['/', '/events', ...(config?.epk ? ['/epk'] : [])];
	const urls = paths
		.map((path) => {
			const loc = `${origin}${path === '/' ? '' : path}`;
			return `\t<url>\n\t\t<loc>${loc}</loc>${lastmod ? `\n\t\t<lastmod>${lastmod}</lastmod>` : ''}\n\t</url>`;
		})
		.join('\n');

	const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

	return new Response(body, {
		headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=3600' }
	});
};
