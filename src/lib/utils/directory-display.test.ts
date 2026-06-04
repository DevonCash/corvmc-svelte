import { describe, it, expect } from 'vitest';
import {
	partitionLinks,
	orderEmbeddableServices,
	isStreamingPlatform,
	isMemberRowPrivate
} from './directory-display';
import type { ProfileLink } from '$lib/server/db/schema/authentication';

const spotify: ProfileLink = {
	label: 'Spotify',
	url: 'https://open.spotify.com/artist/4Z8W4fKeB5YxbusRsdQVPb'
};
const youtube: ProfileLink = { label: 'YT', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' };
const bandcamp: ProfileLink = { label: 'BC', url: 'https://artist.bandcamp.com/album/foo' };
const website: ProfileLink = { label: 'Site', url: 'https://example.com' };
const instagram: ProfileLink = { label: 'IG', url: 'https://instagram.com/artist' };

describe('isStreamingPlatform', () => {
	it('recognizes streaming services', () => {
		expect(isStreamingPlatform('Spotify')).toBe(true);
		expect(isStreamingPlatform('Bandcamp')).toBe(true);
	});
	it('rejects non-streaming and empty', () => {
		expect(isStreamingPlatform('Instagram')).toBe(false);
		expect(isStreamingPlatform(undefined)).toBe(false);
	});
});

describe('partitionLinks', () => {
	it('splits streaming services from web/social links', () => {
		const { streaming, web } = partitionLinks([spotify, website, instagram, bandcamp]);
		expect(streaming).toEqual([spotify, bandcamp]);
		expect(web).toEqual([website, instagram]);
	});

	it('treats unknown links as web', () => {
		const { streaming, web } = partitionLinks([website]);
		expect(streaming).toHaveLength(0);
		expect(web).toEqual([website]);
	});
});

describe('orderEmbeddableServices', () => {
	it('keeps only embeddable services and applies the locked tab order', () => {
		// Bandcamp has no in-page embed, so it is excluded even though it streams.
		const services = orderEmbeddableServices([youtube, spotify, bandcamp, website]);
		expect(services.map((s) => s.name)).toEqual(['Spotify', 'YouTube']);
		expect(services.every((s) => s.embedUrl.length > 0)).toBe(true);
	});

	it('returns empty when nothing is embeddable', () => {
		expect(orderEmbeddableServices([website, bandcamp])).toEqual([]);
	});
});

describe('isMemberRowPrivate', () => {
	it('hides non-public members in the public view', () => {
		expect(isMemberRowPrivate('public', 'members')).toBe(true);
		expect(isMemberRowPrivate('public', 'hidden')).toBe(true);
		expect(isMemberRowPrivate('public', null)).toBe(true);
	});

	it('keeps public members and never hides in the members view', () => {
		expect(isMemberRowPrivate('public', 'public')).toBe(false);
		expect(isMemberRowPrivate('members', 'members')).toBe(false);
		expect(isMemberRowPrivate('members', 'hidden')).toBe(false);
	});
});
