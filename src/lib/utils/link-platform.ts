/**
 * Detect a known platform from a URL and provide icon/embed info.
 */

export type Platform = {
	name: string;
	icon: string; // Tabler icon name
	embedUrl?: string; // iframe src if embeddable
};

const PLATFORM_MATCHERS: Array<{
	pattern: RegExp;
	name: string;
	icon: string;
	getEmbedUrl?: (url: string, match: RegExpMatchArray) => string | undefined;
}> = [
	{
		name: 'YouTube',
		icon: 'IconBrandYoutube',
		pattern: /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/,
		getEmbedUrl: (_url, match) => `https://www.youtube.com/embed/${match[1]}`
	},
	{
		name: 'SoundCloud',
		icon: 'IconBrandSoundcloud',
		pattern: /soundcloud\.com\/[\w-]+\/[\w-]+/,
		getEmbedUrl: (url) =>
			`https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=true`
	},
	{
		name: 'Spotify',
		icon: 'IconBrandSpotify',
		pattern: /open\.spotify\.com\/(track|album|artist|playlist)\/([\w]+)/,
		getEmbedUrl: (_url, match) => `https://open.spotify.com/embed/${match[1]}/${match[2]}`
	},
	{
		name: 'Bandcamp',
		icon: 'IconVinyl',
		pattern: /[\w-]+\.bandcamp\.com\/(track|album)\//
		// Bandcamp embeds require an API lookup for the track/album ID,
		// so we skip auto-embed and just show the icon + link
	},
	{
		name: 'Instagram',
		icon: 'IconBrandInstagram',
		pattern: /instagram\.com/
	},
	{
		name: 'TikTok',
		icon: 'IconBrandTiktok',
		pattern: /tiktok\.com/
	},
	{
		name: 'Facebook',
		icon: 'IconBrandFacebook',
		pattern: /facebook\.com/
	},
	{
		name: 'Twitter',
		icon: 'IconBrandX',
		pattern: /(twitter\.com|x\.com)/
	},
	{
		name: 'Apple Music',
		icon: 'IconBrandApple',
		pattern: /music\.apple\.com\//,
		// Only album/playlist/song URLs have an in-page embed; artist pages
		// are still recognized (icon + link) but skip the embed.
		getEmbedUrl: (url) =>
			/music\.apple\.com\/[\w-]+\/(album|playlist|song)\//.test(url)
				? `https://embed.music.apple.com/${url.replace('https://music.apple.com/', '')}`
				: undefined
	},
	{
		name: 'Amazon Music',
		icon: 'IconBrandAmazon',
		pattern: /music\.amazon\./
	},
	{
		name: 'GitHub',
		icon: 'IconBrandGithub',
		pattern: /github\.com/
	},
	{
		name: 'LinkedIn',
		icon: 'IconBrandLinkedin',
		pattern: /linkedin\.com/
	}
];

export function detectPlatform(url: string): Platform | null {
	for (const matcher of PLATFORM_MATCHERS) {
		const match = url.match(matcher.pattern);
		if (match) {
			return {
				name: matcher.name,
				icon: matcher.icon,
				embedUrl: matcher.getEmbedUrl?.(url, match)
			};
		}
	}
	return null;
}

/** Check if a URL has an embeddable player */
export function getEmbedUrl(url: string): string | undefined {
	return detectPlatform(url)?.embedUrl;
}
