import { expect, test } from '@playwright/test';
import {
	SEED_PUBLIC_BAND_SLUG,
	SEED_PUBLIC_BAND_NAME,
	SEED_PREMIUM_BAND_SLUG,
	SEED_PREMIUM_BAND_NAME
} from './fixtures/seed-band-onboarding';

/**
 * Every band has {slug}.<domain>, free. What it serves depends on tier:
 * premium bands get their block-editor microsite, everyone else is redirected
 * to their directory profile — so a band can hand out the address either way.
 *
 * The base domain comes from PUBLIC_SITE_URL, which playwright.config.ts pins
 * to http://localhost:4173, making {slug}.localhost:4173 a real band address
 * that exercises the same hooks as {slug}.corvmc.org in production.
 */
const PORT = 4173;
const subdomain = (slug: string) => `http://${slug}.localhost:${PORT}`;

test('a free band subdomain redirects to its directory profile', async ({ page }) => {
	const response = await page.goto(`${subdomain(SEED_PUBLIC_BAND_SLUG)}/`);

	expect(response?.status()).toBe(200); // after following the redirect
	expect(page.url()).toContain(`/directory/bands/${SEED_PUBLIC_BAND_SLUG}`);
	await expect(page.getByRole('heading', { name: SEED_PUBLIC_BAND_NAME })).toBeVisible({
		timeout: 15000
	});
});

test('the redirect is a real 302, not a client-side bounce', async ({ request }) => {
	const response = await request.get(`${subdomain(SEED_PUBLIC_BAND_SLUG)}/`, {
		maxRedirects: 0
	});

	expect(response.status()).toBe(302);
	expect(response.headers()['location']).toContain(`/directory/bands/${SEED_PUBLIC_BAND_SLUG}`);
});

test('a premium band subdomain serves its band site', async ({ page }) => {
	await page.goto(`${subdomain(SEED_PREMIUM_BAND_SLUG)}/`);

	// Stays on the subdomain — no redirect to the directory.
	expect(page.url()).toContain(`${SEED_PREMIUM_BAND_SLUG}.localhost`);
	expect(page.url()).not.toContain('/directory/');
	await expect(page).toHaveTitle(new RegExp(SEED_PREMIUM_BAND_NAME));
});

test('an unknown subdomain redirects to a directory 404 rather than erroring', async ({ page }) => {
	await page.goto(`${subdomain('no-such-band-xyz')}/`);

	expect(page.url()).toContain('/directory/bands/no-such-band-xyz');
	await expect(page.getByText(/not found/i).first()).toBeVisible({ timeout: 15000 });
});

test('the host-route lookup reports no band for an unrelated hostname', async ({ request }) => {
	const response = await request.get(
		`http://localhost:${PORT}/api/host-route?host=not-a-band.example.com`
	);

	expect(response.ok()).toBe(true);
	expect(await response.json()).toEqual({ slug: null });
});
