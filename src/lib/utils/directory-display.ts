/**
 * Pure display helpers shared by the directory profile components and the
 * profile remote queries. Kept free of DB/Svelte deps so they can be unit
 * tested and reused on both client and server.
 */
import { detectPlatform } from './link-platform';
import type { ProfileLink } from '$lib/server/db/schema/authentication';

/** Services that belong in the icon-only "Listen on" ribbon / the Listen tabs. */
export const STREAMING_PLATFORMS = [
	'Spotify',
	'Bandcamp',
	'SoundCloud',
	'YouTube',
	'Apple Music',
	'Amazon Music',
	'Tidal'
] as const;

const STREAMING_SET = new Set<string>(STREAMING_PLATFORMS);

export function isStreamingPlatform(name: string | undefined | null): boolean {
	return !!name && STREAMING_SET.has(name);
}

export type EmbeddableService = { link: ProfileLink; name: string; embedUrl: string };

/**
 * The embeddable streaming services for a set of links, in the locked tab
 * order. Only links whose platform exposes an in-page embed are included.
 */
export function orderEmbeddableServices(links: ProfileLink[]): EmbeddableService[] {
	return links
		.map((link): EmbeddableService | null => {
			const platform = detectPlatform(link.url);
			return platform?.embedUrl ? { link, name: platform.name, embedUrl: platform.embedUrl } : null;
		})
		.filter((s): s is EmbeddableService => s !== null)
		.sort((a, b) => streamingRank(a.name) - streamingRank(b.name));
}

function streamingRank(name: string): number {
	const i = STREAMING_PLATFORMS.indexOf(name as (typeof STREAMING_PLATFORMS)[number]);
	return i === -1 ? STREAMING_PLATFORMS.length : i;
}

export type PartitionedLinks = {
	/** streaming services — rendered as the icon ribbon */
	streaming: ProfileLink[];
	/** everything else (web, social, EPK) — rendered as labelled rows */
	web: ProfileLink[];
};

/** Split a link list into the streaming ribbon vs. the web/social rows. */
export function partitionLinks(links: ProfileLink[]): PartitionedLinks {
	const streaming: ProfileLink[] = [];
	const web: ProfileLink[] = [];
	for (const link of links) {
		if (isStreamingPlatform(detectPlatform(link.url)?.name)) streaming.push(link);
		else web.push(link);
	}
	return { streaming, web };
}

/**
 * Whether a band's member row should be shown as a locked, unlinked row. In
 * the public view, a member who hasn't opted their own profile to `public` is
 * withheld (but still counted); in the members view everyone is visible.
 */
export function isMemberRowPrivate(
	viewVisibility: 'members' | 'public',
	memberVisibility: string | null | undefined
): boolean {
	return viewVisibility === 'public' && memberVisibility !== 'public';
}
