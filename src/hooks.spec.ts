import { describe, it, expect, vi } from 'vitest';

vi.mock('$env/dynamic/public', () => ({
	env: { PUBLIC_SITE_URL: 'https://corvmc.org' }
}));

import { reroute } from './hooks';

function run(url: string) {
	return (reroute as (event: { url: URL }) => string | undefined)({ url: new URL(url) });
}

describe('reroute', () => {
	it('maps band subdomains to /band-site/{slug}', () => {
		expect(run('https://the-neons.corvmc.org/')).toBe('/band-site/the-neons/');
		expect(run('https://the-neons.corvmc.org/events')).toBe('/band-site/the-neons/events');
		expect(run('https://the-neons.corvmc.org/epk')).toBe('/band-site/the-neons/epk');
	});

	it('leaves the apex and www untouched', () => {
		expect(run('https://corvmc.org/member')).toBe('/member');
		expect(run('https://www.corvmc.org/')).toBe('/');
	});

	it('leaves reserved subdomains untouched', () => {
		expect(run('https://media.corvmc.org/bands/x.jpg')).toBe('/bands/x.jpg');
		expect(run('https://api.corvmc.org/health')).toBe('/health');
		expect(run('https://admin.corvmc.org/')).toBe('/');
		expect(run('https://staging.corvmc.org/login')).toBe('/login');
	});

	it('ignores nested subdomains', () => {
		expect(run('https://a.b.corvmc.org/')).toBe('/');
	});

	it('leaves unrelated hosts untouched', () => {
		expect(run('https://corvmc.devon-cash.workers.dev/member')).toBe('/member');
		expect(run('http://localhost:5173/directory')).toBe('/directory');
	});

	it('supports the dev override query param', () => {
		expect(run('http://localhost:5173/?__band_subdomain=the-neons')).toBe('/band-site/the-neons/');
		expect(run('http://localhost:5173/events?__band_subdomain=the-neons')).toBe(
			'/band-site/the-neons/events'
		);
	});
});
