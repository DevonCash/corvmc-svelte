import { describe, it, expect } from 'vitest';
import { isLocalOrigin } from './sentry-local-origin';

describe('isLocalOrigin', () => {
	it('drops the preview server that leaked e2e runs into production Sentry', () => {
		// The exact URLs from JAVASCRIPT-SVELTEKIT-1W/1X/1Y/1Z.
		expect(isLocalOrigin('http://localhost:4173/directory/bands/does-not-exist-xyz')).toBe(true);
		expect(isLocalOrigin('http://localhost:4173/_app/version.json')).toBe(true);
	});

	it('drops the other loopback spellings', () => {
		expect(isLocalOrigin('http://127.0.0.1:5173/')).toBe(true);
		expect(isLocalOrigin('http://[::1]:4173/_app/version.json')).toBe(true);
		expect(isLocalOrigin('http://0.0.0.0:8788/')).toBe(true);
	});

	it('drops .localhost subdomains used by local band sites', () => {
		expect(isLocalOrigin('http://some-band.localhost:5173/')).toBe(true);
	});

	it('keeps production traffic', () => {
		expect(isLocalOrigin('https://corvmc.org/events/abc')).toBe(false);
		expect(isLocalOrigin('https://some-band.corvmc.org/')).toBe(false);
		expect(isLocalOrigin('https://corvmc.devon-cash.workers.dev/')).toBe(false);
	});

	it('does not match a host that merely contains "localhost"', () => {
		expect(isLocalOrigin('https://localhost.corvmc.org/')).toBe(false);
		expect(isLocalOrigin('https://notlocalhost/')).toBe(false);
	});

	it('lets events through when the URL is missing or unparseable', () => {
		// Better to keep a real production error than drop it on a bad URL.
		expect(isLocalOrigin(undefined)).toBe(false);
		expect(isLocalOrigin(null)).toBe(false);
		expect(isLocalOrigin('')).toBe(false);
		expect(isLocalOrigin('not a url')).toBe(false);
	});
});
