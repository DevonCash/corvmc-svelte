import { expect, test, type Page } from '@playwright/test';
import {
	SEED_STAFF_EMAIL,
	SEED_STAFF_PASSWORD,
	SEED_TARGET_ID,
	SEED_TARGET_NAME
} from './fixtures/seed-staff-user';

/**
 * End-to-end coverage for the staff user-management screens.
 *
 * Until this spec existed, no `/staff` route had any e2e coverage — every
 * fixture seeded a plain member. Two critical defects shipped through that gap
 * (see docs/reports/staff-user-management-audit.md): unguarded remote endpoints,
 * and a FormField bug that made every profile save wipe the user's roles.
 *
 * The role-preservation test below is the end-to-end pin for that second one:
 * `updateUser` replaces `model_has_roles` wholesale, so a Roles field that fails
 * to pre-fill silently submits `[]` and strips `staff`/`admin` off the account as
 * a side effect of correcting a phone number.
 */

async function loginAsStaff(page: Page) {
	await page.goto('/login');
	// FormField renders a <legend>, not a <label for>, so target inputs by name.
	await page.locator('input[name="email"]').fill(SEED_STAFF_EMAIL);
	await page.locator('input[name="password"]').fill(SEED_STAFF_PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await page.waitForURL(/\/member(\/|$|\?)/, { timeout: 15000 });
}

test.describe('staff user management', () => {
	test('staff can open the users list', async ({ page }) => {
		await loginAsStaff(page);

		await page.goto('/staff/users');

		// Not bounced to `/` (non-staff) or `/login` (anonymous).
		await expect(page).toHaveURL(/\/staff\/users/);
		await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();

		// The row for the seeded edit target is reachable from the list.
		await expect(page.getByRole('table')).toBeVisible();
		// The list states its size. This used to be a "N total" count in the page
		// header; rebuilding the staff tables moved it into the pagination line,
		// which states the visible range as well as the total.
		await expect(page.getByText(/Showing \d+–\d+ of \d+/)).toBeVisible();
	});

	test('editing a profile field preserves the user’s roles', async ({ page }) => {
		await loginAsStaff(page);
		await page.goto(`/staff/users/${SEED_TARGET_ID}`);

		// The heading is in the page header, which is shared by every tab.
		await expect(page.getByRole('heading', { name: SEED_TARGET_NAME })).toBeVisible();

		// The edit form lives behind the Account tab now that this page is a
		// cross-section rather than a form. Panels mount on first selection, so
		// nothing renders a roles input until this click.
		//
		// `radio`, not `button`: TabBar's client-state mode is a bits-ui
		// ToggleGroup, whose items expose the radio role.
		await page.getByRole('radio', { name: 'Account' }).click();

		// TagInput serialises the selection into a hidden input — this is the exact
		// value updateUser rewrites model_has_roles from.
		const rolesInput = page.locator('input[name="roles"]');
		await expect(rolesInput).toHaveCount(1);

		const rolesBefore = await rolesInput.inputValue();
		// The field must arrive pre-filled. The bug shipped as `[]` here.
		expect(JSON.parse(rolesBefore)).not.toHaveLength(0);

		// Edit an unrelated field and save.
		const phone = `555${Date.now().toString().slice(-7)}`;
		const phoneInput = page.locator('input[name="phone"]');
		await phoneInput.fill(phone);
		await page.getByRole('button', { name: 'Save' }).click();

		// SubmitButton flips to its success label once the write lands.
		await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible({ timeout: 15000 });

		// Re-read from the server: the edit stuck AND the roles survived it.
		// `?tab=account` also pins the URL contract the TabBar writes.
		await page.goto(`/staff/users/${SEED_TARGET_ID}?tab=account`);
		await expect(page.locator('input[name="phone"]')).toHaveValue(phone);

		const rolesAfter = await page.locator('input[name="roles"]').inputValue();
		expect(JSON.parse(rolesAfter)).toEqual(JSON.parse(rolesBefore));
	});

	test('the member record opens on Overview and loads each tab only when opened', async ({
		page
	}) => {
		await loginAsStaff(page);
		await page.goto(`/staff/users/${SEED_TARGET_ID}`);

		// Default tab. Its content comes from the same overview query the header
		// and the tab badges already needed, so it costs no extra request.
		await expect(page.getByRole('heading', { name: 'At a glance' })).toBeVisible();

		// Panels are lazy: nothing from Money has been mounted yet, so its cards
		// are absent from the DOM rather than merely hidden.
		await expect(page.getByRole('heading', { name: 'Credit history' })).toHaveCount(0);

		await page.getByRole('radio', { name: 'Money' }).click();
		await expect(page.getByRole('heading', { name: 'Credit history' })).toBeVisible();
		await expect(page).toHaveURL(/[?&]tab=money/);
	});

	test('a tab is addressable by URL, and an unknown one falls back to Overview', async ({
		page
	}) => {
		await loginAsStaff(page);

		await page.goto(`/staff/users/${SEED_TARGET_ID}?tab=bands`);
		// The user → bands direction did not exist anywhere in the app before this
		// page; this is the pin that it does now.
		await expect(page.getByRole('heading', { name: 'Bands', exact: true })).toBeVisible();

		await page.goto(`/staff/users/${SEED_TARGET_ID}?tab=not-a-tab`);
		await expect(page.getByRole('heading', { name: 'At a glance' })).toBeVisible();
	});

	test('switching tabs keeps an unsaved edit', async ({ page }) => {
		await loginAsStaff(page);
		await page.goto(`/staff/users/${SEED_TARGET_ID}?tab=account`);

		// Panels are kept mounted once visited rather than re-created on every
		// tab change. Form's `guard` only blocks navigation, and a tab switch is
		// not one — so unmounting here would discard a half-typed edit silently.
		const draft = `555${Date.now().toString().slice(-7)}`;
		await page.locator('input[name="phone"]').fill(draft);

		await page.getByRole('radio', { name: 'Money' }).click();
		await expect(page.getByRole('heading', { name: 'Credit history' })).toBeVisible();

		await page.getByRole('radio', { name: 'Account' }).click();
		await expect(page.locator('input[name="phone"]')).toHaveValue(draft);
	});

	test('bulk selection does not survive paging to rows you cannot see', async ({ page }) => {
		await loginAsStaff(page);
		await page.goto('/staff/users');

		const selectAll = page.locator('thead input[type="checkbox"]');
		await expect(selectAll).toBeVisible();
		await selectAll.check();

		// The bulk bar appears with a count of the selected rows.
		const bulkBar = page.getByText(/\d+ selected/);
		await expect(bulkBar).toBeVisible();

		// Page 2 shows a different set of rows. The selection previously persisted,
		// leaving the bar reading e.g. "20 selected" while Deactivate acted on rows
		// the operator could no longer see.
		await page.getByRole('button', { name: '2', exact: true }).click();

		await expect(bulkBar).toHaveCount(0);
	});
});
