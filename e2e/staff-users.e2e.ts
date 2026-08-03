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
		await expect(page.getByText(/\d+ total/)).toBeVisible();
	});

	test('editing a profile field preserves the user’s roles', async ({ page }) => {
		await loginAsStaff(page);
		await page.goto(`/staff/users/${SEED_TARGET_ID}`);

		await expect(page.getByRole('heading', { name: SEED_TARGET_NAME })).toBeVisible();

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
		await page.goto(`/staff/users/${SEED_TARGET_ID}`);
		await expect(page.locator('input[name="phone"]')).toHaveValue(phone);

		const rolesAfter = await page.locator('input[name="roles"]').inputValue();
		expect(JSON.parse(rolesAfter)).toEqual(JSON.parse(rolesBefore));
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
