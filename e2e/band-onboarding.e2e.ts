import { expect, test } from '@playwright/test';
import {
	SEED_OWNER_EMAIL,
	SEED_OWNER_PASSWORD,
	SEED_PUBLIC_BAND_SLUG,
	SEED_PUBLIC_BAND_NAME,
	SEED_PUBLIC_BAND_HOMETOWN,
	SEED_PUBLIC_BAND_FOUNDED,
	SEED_HIDDEN_BAND_SLUG,
	SEED_MEMBERS_BAND_SLUG,
	SEED_MEMBERS_BAND_NAME
} from './fixtures/seed-band-onboarding';

/**
 * Regression tests for the band directory onboarding flow.
 *
 * 1. The band profile edit page (/band/[slug]/edit) crashed on load with
 *    Svelte's effect_update_depth_exceeded — the same async-page-script bug
 *    fixed for /member/profile in 7a1ceed but never applied to the band pages —
 *    so the "enrich your profile" onboarding step was unusable.
 * 2. The edit form rendered no hometown/foundedYear inputs, so every save
 *    silently nulled both columns (they render on the public profile).
 * 3. Band detail pages ignored band.directoryVisibility: hidden/members bands
 *    disappeared from directory listings but stayed fully readable at their
 *    public URL, logged-out.
 * 4. Both sidebar "Create Band" nav links pointed at /member/bands/create,
 *    which does not exist (404); the create modal lives on /member/bands.
 */

async function login(page: import('@playwright/test').Page) {
	await page.goto('/login');
	// FormField renders a <legend>, not a <label for>, so target inputs by name.
	await page.locator('input[name="email"]').fill(SEED_OWNER_EMAIL);
	await page.locator('input[name="password"]').fill(SEED_OWNER_PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await page.waitForURL(/\/member(\/|$|\?)/, { timeout: 15000 });
}

test('band profile edit page renders the form for an owner', async ({ page }) => {
	await login(page);
	await page.goto(`/band/${SEED_PUBLIC_BAND_SLUG}/edit`);

	// The regression rendered a "Failed to load: effect_update_depth_exceeded"
	// banner instead of the form.
	await expect(page.locator('input[name="name"]')).toBeVisible({ timeout: 15000 });
	await expect(page.getByText(/failed to load/i)).toHaveCount(0);

	// The profile fields the public page displays are all editable — hometown
	// and foundedYear were missing entirely, which wiped them on save.
	await expect(page.locator('input[name="hometown"]')).toHaveValue(SEED_PUBLIC_BAND_HOMETOWN);
	await expect(page.locator('input[name="foundedYear"]')).toHaveValue(SEED_PUBLIC_BAND_FOUNDED);
});

test('saving the profile preserves hometown and founded year', async ({ page }) => {
	await login(page);
	await page.goto(`/band/${SEED_PUBLIC_BAND_SLUG}/edit`);
	await expect(page.locator('input[name="name"]')).toBeVisible({ timeout: 15000 });

	// Dirty the form so the submit is a real save, then save.
	await page.locator('input[name="tagline"]').fill('E2E save round-trip');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByText('Profile saved')).toBeVisible({ timeout: 15000 });

	// The public profile still shows "Based in {hometown}" / "Formed {year}".
	await page.goto(`/directory/bands/${SEED_PUBLIC_BAND_SLUG}`);
	await expect(page.getByText(SEED_PUBLIC_BAND_HOMETOWN)).toBeVisible();
	await expect(page.getByText(SEED_PUBLIC_BAND_FOUNDED)).toBeVisible();
});

// Band pages resolve their data client-side through remote queries, so the
// HTTP response is always a 200 shell; the visibility gate surfaces as the
// boundary's "Band not found" state with no profile content rendered.
test('hidden band detail page is not publicly readable', async ({ page }) => {
	await page.goto(`/directory/bands/${SEED_HIDDEN_BAND_SLUG}`);
	// .first(): the message renders in both the boundary alert and the error toast.
	await expect(page.getByText('Band not found').first()).toBeVisible({ timeout: 15000 });
	await expect(page.getByText('E2E Hidden Band')).toHaveCount(0);
	await expect(page.getByText('opted out of the directory')).toHaveCount(0);
});

test('members-only band is withheld publicly but renders in the member directory', async ({
	page
}) => {
	await page.goto(`/directory/bands/${SEED_MEMBERS_BAND_SLUG}`);
	// .first(): the message renders in both the boundary alert and the error toast.
	await expect(page.getByText('Band not found').first()).toBeVisible({ timeout: 15000 });
	await expect(page.getByText(SEED_MEMBERS_BAND_NAME)).toHaveCount(0);

	await login(page);
	await page.goto(`/member/directory/bands/${SEED_MEMBERS_BAND_SLUG}`);
	await expect(page.getByText(SEED_MEMBERS_BAND_NAME).first()).toBeVisible({ timeout: 15000 });
});

// Regression (JAVASCRIPT-SVELTEKIT-24): renaming a band rotates its slug, but
// saveBandProfile then refreshed getBandProfile, which re-resolves the band from
// `params.slug` — still the pre-rename value, because for a remote request it
// comes from the `x-sveltekit-pathname` header the client sent. The lookup 404s,
// SvelteKit ships that per-query failure to the client, and `apply_refreshes`
// calls `resource.fail(...)`: the save succeeds and the page it just saved drops
// into a "Band not found" state.
//
// This is the first save of every newly created band — a new band starts out
// slugged after its creator and gets its real name on that first save.
//
// Renames the seeded band and puts the name back, so the tests above (which key
// off SEED_PUBLIC_BAND_SLUG) still pass on a re-run.
test('renaming a band saves cleanly and follows the new slug', async ({ page }) => {
	const consoleErrors: string[] = [];
	page.on('console', (m) => {
		if (m.type() === 'error') consoleErrors.push(m.text());
	});

	await login(page);
	await page.goto(`/band/${SEED_PUBLIC_BAND_SLUG}/edit`);
	await expect(page.locator('input[name="name"]')).toBeVisible({ timeout: 15000 });

	await page.locator('input[name="name"]').fill('E2E Renamed Band');
	await page.getByRole('button', { name: 'Save' }).click();

	await expect(page.getByText('Profile saved')).toBeVisible({ timeout: 15000 });
	// The save worked, so nothing on the page may claim the band is missing.
	await expect(page.getByText('Band not found')).toHaveCount(0);
	await page.waitForURL(/\/band\/e2e-renamed-band\/edit/, { timeout: 15000 });

	// The reported failure was a caught exception: the form swallowed it into a
	// toast and only the console (and Sentry) showed the real cause.
	expect(consoleErrors.join('\n')).not.toContain('JSON.parse');

	// Restore, so this test is re-runnable and the earlier tests keep their slug.
	// Reload first: the redirect above only fires for the first rename of a page
	// session, so a second save in-place would leave the form on the old URL.
	await page.goto('/band/e2e-renamed-band/edit');
	await expect(page.locator('input[name="name"]')).toBeVisible({ timeout: 15000 });
	await page.locator('input[name="name"]').fill(SEED_PUBLIC_BAND_NAME);
	await page.getByRole('button', { name: 'Save' }).click();
	await page.waitForURL(new RegExp(`/band/${SEED_PUBLIC_BAND_SLUG}/edit`), { timeout: 15000 });
});

test('sidebar Create Band links open the create-band modal', async ({ page }) => {
	await login(page);

	// Both nav entries pointed at /member/bands/create, a 404; they must point
	// at the bands page with the create param instead.
	const createLink = page.getByRole('link', { name: 'Create Band' }).first();
	await expect(createLink).toHaveAttribute('href', '/member/bands?create=1');

	// Clicking the link (immediately after login, while the layout's async
	// queries are still settling) opens the create-band modal. The link carries
	// data-sveltekit-reload because a client-side navigation in that window can
	// leave the modal permanently unmounted — a svelte experimental-async
	// scheduling gap still present in 5.56.8; e2e/create-band-modal.e2e.ts
	// covers the related client-side-nav + button regression.
	await createLink.click();
	await page.waitForURL(/\/member\/bands\?create=1/, { timeout: 15000 });
	await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15000 });
	await expect(page.getByRole('dialog').locator('input[name="name"]')).toBeVisible();
});
