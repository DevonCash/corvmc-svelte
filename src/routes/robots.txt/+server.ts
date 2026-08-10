import type { RequestHandler } from '@sveltejs/kit';

/**
 * Site-wide robots.txt.
 *
 * A route rather than static/robots.txt: static assets are served before hooks
 * and routing run, so a file here would shadow the per-band robots.txt on band
 * addresses ({slug}.corvmc.org/robots.txt, which reroute maps to
 * /band-site/{slug}/robots.txt). As a route, the reroute wins and each band
 * address gets its own.
 */
export const GET: RequestHandler = () => {
	const body = ['# allow crawling everything by default', 'User-agent: *', 'Disallow:', ''].join(
		'\n'
	);

	return new Response(body, {
		headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'public, max-age=3600' }
	});
};
