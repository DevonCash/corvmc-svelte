import { expect, test } from '@playwright/test';

/**
 * Regression test for the public band-profile 404 message in PRODUCTION builds.
 *
 * Background: the band page had two sibling async deriveds —
 *   let data = $derived(await getPublicBandProfile(slug));
 *   let shows = $derived(await getBandShows(data.band.id));
 * When the profile query rejected with a 404 HttpError, the sibling derived
 * read `data.band.id` during the same flush; in the minified prod build a
 * TypeError from Svelte internals ("Cannot read properties of null (reading
 * 'f')") reached the svelte:boundary before the real 404, so the failed
 * snippet showed the internals error instead of "Band not found". Dev builds
 * were unaffected, which is why this must run against build + preview.
 */

test('band profile 404 shows "Band not found", not a minified internals error', async ({
	page
}) => {
	await page.goto('/directory/bands/does-not-exist-xyz');

	await expect(page.locator('body')).toContainText('Band not found');
	await expect(page.locator('body')).not.toContainText('Cannot read properties');
});

test('member profile 404 shows "Member not found", not a minified internals error', async ({
	page
}) => {
	await page.goto('/directory/members/does-not-exist-xyz');

	await expect(page.locator('body')).toContainText('Member not found');
	await expect(page.locator('body')).not.toContainText('Cannot read properties');
});
