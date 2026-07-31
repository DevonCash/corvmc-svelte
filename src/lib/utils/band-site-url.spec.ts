import { describe, it, expect } from 'vitest';
import { bandSiteHref, bandSitePath, baseDomainFromSiteUrl } from './band-site-url';

describe('bandSiteHref', () => {
	it('emits plain paths on a real subdomain', () => {
		const url = new URL('https://the-neons.corvmc.org/');
		expect(bandSiteHref('the-neons', '', url)).toBe('/');
		expect(bandSiteHref('the-neons', '/events', url)).toBe('/events');
		expect(bandSiteHref('the-neons', '/epk', url)).toBe('/epk');
	});

	it('keeps the dev override query param', () => {
		const url = new URL('http://localhost:5173/?__band_subdomain=the-neons');
		expect(bandSiteHref('the-neons', '/events', url)).toBe('/events?__band_subdomain=the-neons');
		expect(bandSiteHref('the-neons', '', url)).toBe('/?__band_subdomain=the-neons');
	});

	it('keeps the /band-site prefix on path-based access', () => {
		const url = new URL('https://corvmc.org/band-site/the-neons');
		expect(bandSiteHref('the-neons', '/events', url)).toBe('/band-site/the-neons/events');
		expect(bandSiteHref('the-neons', '', url)).toBe('/band-site/the-neons');
	});
});

describe('bandSitePath', () => {
	it('strips the /band-site prefix', () => {
		expect(bandSitePath('the-neons', new URL('https://x.org/band-site/the-neons/events'))).toBe(
			'/events'
		);
		expect(bandSitePath('the-neons', new URL('https://x.org/band-site/the-neons'))).toBe('/');
	});

	it('passes through subdomain paths', () => {
		expect(bandSitePath('the-neons', new URL('https://the-neons.corvmc.org/events'))).toBe(
			'/events'
		);
	});
});

describe('baseDomainFromSiteUrl', () => {
	it('derives the hostname and strips www', () => {
		expect(baseDomainFromSiteUrl('https://corvmc.org')).toBe('corvmc.org');
		expect(baseDomainFromSiteUrl('https://www.corvmc.org')).toBe('corvmc.org');
		expect(baseDomainFromSiteUrl('https://staging.corvmc.org')).toBe('staging.corvmc.org');
	});

	it('falls back to production on missing or invalid input', () => {
		expect(baseDomainFromSiteUrl(undefined)).toBe('corvmc.org');
		expect(baseDomainFromSiteUrl('not a url')).toBe('corvmc.org');
	});
});
