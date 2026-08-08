import { test, expect, type Page } from '@playwright/test';
import { SEED_STAFF_EMAIL, SEED_STAFF_PASSWORD } from './fixtures/seed-staff-user';
import {
	SEED_VOL_MEMBER_EMAIL,
	SEED_VOL_MEMBER_PASSWORD,
	SEED_VOL_ROLE_NAME,
	SEED_VOL_ARCHIVED_ROLE_NAME,
	SEED_VOL_ROLE_BOLD_PHRASE,
	SEED_VOL_LOG_APPROVE_DESC,
	SEED_VOL_LOG_REJECT_DESC,
	SEED_VOL_LOG_REJECTED_DESC,
	SEED_VOL_REJECTED_REASON,
	readVolunteerState
} from './fixtures/seed-volunteering';

/**
 * End-to-end coverage for the volunteering module (Phase 1).
 *
 * These pin the three things the service unit tests structurally cannot reach,
 * each of which shipped broken during development and was caught only by
 * clicking the page:
 *
 *  1. A review must remove the row from the Pending table. SvelteKit's
 *     `refresh()` is keyed by argument, so refreshing `getStaffVolunteerLogs({})`
 *     from the remote function updated the argless tab counts while the
 *     arg-keyed table kept rendering the row that had just been approved.
 *  2. A rejection with no reason must show written copy. The zod `.min(1)` fired
 *     before the service's own message and rendered "Too small: expected string
 *     to have >=1 characters" at staff.
 *  3. Approving must not mint practice credits. The unit suite asserts the
 *     credit service is never called; this asserts no row actually lands.
 */

async function login(page: Page, email: string, password: string) {
	await page.goto('/login');
	// FormField renders a <legend>, not a <label for>, so target inputs by name.
	await page.locator('input[name="email"]').fill(email);
	await page.locator('input[name="password"]').fill(password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await page.waitForURL(/\/member(\/|$|\?)/, { timeout: 15000 });
}

/** The row's action buttons are icon-only; scope by the row's description text. */
function rowFor(page: Page, description: string) {
	return page.locator('tr').filter({ hasText: description });
}

/**
 * An icon-only `Action` renders its real button inside a bits-ui tooltip
 * trigger, which is itself a `<button>` — so `getByRole('button', { name })`
 * matches two elements and trips strict mode. Target the inner one by its
 * `data-button-root` marker. (The nested-button pair is a real a11y defect in
 * the shared Button component, tracked separately; these selectors work either
 * way once it is fixed.)
 */
function rowAction(row: ReturnType<typeof rowFor>, name: string) {
	return row.locator(`button[data-button-root][aria-label="${name}"]`);
}

/** The modal's submit button, scoped so row actions of the same name can't match. */
function modalSubmit(page: Page, name: string) {
	return page.getByRole('dialog').getByRole('button', { name, exact: true });
}

test.describe('volunteering — staff review queue', () => {
	test('approving a log removes it from Pending and moves the counts', async ({ page }) => {
		await login(page, SEED_STAFF_EMAIL, SEED_STAFF_PASSWORD);
		await page.goto('/staff/volunteer');

		const row = rowFor(page, SEED_VOL_LOG_APPROVE_DESC);
		await expect(row).toBeVisible();

		await rowAction(row, 'Approve').click();
		await modalSubmit(page, 'Approve').click();

		// The regression: the row has to leave the table, not just the counts.
		await expect(row).toHaveCount(0, { timeout: 15000 });

		const state = await readVolunteerState();
		expect(state.approveLogStatus).toBe('approved');
		// Volunteer hours are a record, not a currency. Asserted in the same test
		// as the approval rather than its own: the fixture seeds one approvable
		// log and the suite shares a database, so a second test approving "the
		// same" row finds it already gone.
		expect(state.creditRowCount).toBe(0);
	});

	test('rejecting without a reason shows written copy, not raw zod text', async ({ page }) => {
		await login(page, SEED_STAFF_EMAIL, SEED_STAFF_PASSWORD);
		await page.goto('/staff/volunteer');

		const row = rowFor(page, SEED_VOL_LOG_REJECT_DESC);
		await rowAction(row, 'Reject').click();
		await modalSubmit(page, 'Reject').click();

		await expect(page.getByText(/give the member a reason/i)).toBeVisible({ timeout: 15000 });
		await expect(page.getByText(/expected string to have/i)).toHaveCount(0);
	});

	test('a rejection records its reason and leaves the pending queue', async ({ page }) => {
		await login(page, SEED_STAFF_EMAIL, SEED_STAFF_PASSWORD);
		await page.goto('/staff/volunteer');

		const reason = 'E2E: hours look doubled for this shift.';
		const row = rowFor(page, SEED_VOL_LOG_REJECT_DESC);
		await rowAction(row, 'Reject').click();
		await page.locator('textarea[name="notes"]').fill(reason);
		await modalSubmit(page, 'Reject').click();
		await expect(row).toHaveCount(0, { timeout: 15000 });

		// Kept staff-side deliberately: signing a second user in over an existing
		// session in the same browser context does not swap the session, so the
		// member view is asserted separately from its own login.
		await page.getByRole('radio', { name: /Rejected/ }).click();
		const rejected = rowFor(page, SEED_VOL_LOG_REJECT_DESC);
		await expect(rejected).toBeVisible({ timeout: 15000 });
		await expect(rejected).toContainText(reason);
	});
});

test.describe('volunteering — roles', () => {
	test('a role with logged hours cannot be deleted, and says to archive instead', async ({
		page
	}) => {
		await login(page, SEED_STAFF_EMAIL, SEED_STAFF_PASSWORD);
		await page.goto('/staff/volunteer/roles');

		const row = rowFor(page, SEED_VOL_ROLE_NAME);
		await expect(row).toBeVisible();

		// Delete is offered only for a role nothing was logged against, so the
		// guard is that the control is absent for one that has history.
		await expect(rowAction(row, 'Delete')).toHaveCount(0);
		await expect(rowAction(row, 'Archive')).toBeVisible();
	});

	test('an archived role stays visible to staff', async ({ page }) => {
		await login(page, SEED_STAFF_EMAIL, SEED_STAFF_PASSWORD);
		await page.goto('/staff/volunteer/roles');

		// Retiring a role must not hide the work done under it.
		await expect(rowFor(page, SEED_VOL_ARCHIVED_ROLE_NAME)).toBeVisible();
		await expect(rowAction(rowFor(page, SEED_VOL_ARCHIVED_ROLE_NAME), 'Restore')).toBeVisible();
	});

	test('the report counts hours logged under a since-archived role', async ({ page }) => {
		await login(page, SEED_STAFF_EMAIL, SEED_STAFF_PASSWORD);
		await page.goto('/staff/volunteer/report');

		await expect(page.getByText(SEED_VOL_ARCHIVED_ROLE_NAME)).toBeVisible({ timeout: 15000 });
	});
});

test.describe('volunteering — member', () => {
	test('the member page renders a role job description as markdown', async ({ page }) => {
		await login(page, SEED_VOL_MEMBER_EMAIL, SEED_VOL_MEMBER_PASSWORD);
		await page.goto('/member/volunteer');

		await expect(page.getByText(SEED_VOL_ROLE_NAME).first()).toBeVisible();
		// The seeded description bolds this phrase; rendered markdown means a
		// <strong>, not literal asterisks. This was shipped broken — the page ran
		// the markdown through `sanitizeBio`, an HTML sanitizer, which left the
		// asterisks on screen.
		await expect(page.locator('strong', { hasText: SEED_VOL_ROLE_BOLD_PHRASE })).toBeVisible();
		await expect(page.getByText(`**${SEED_VOL_ROLE_BOLD_PHRASE}**`)).toHaveCount(0);

		// Archiving hides a role from the picker only — the member's own history
		// still names it, so this is scoped to the browse section rather than the
		// whole page.
		const browse = page.getByRole('heading', { name: 'What you can help with' }).locator('..');
		await expect(browse.getByText(SEED_VOL_ARCHIVED_ROLE_NAME)).toHaveCount(0);
		await expect(browse.getByText(SEED_VOL_ROLE_NAME)).toBeVisible();
	});

	test('a rejected log shows the member the reason', async ({ page }) => {
		await login(page, SEED_VOL_MEMBER_EMAIL, SEED_VOL_MEMBER_PASSWORD);
		await page.goto('/member/volunteer');

		// Without the reason the member cannot correct and resubmit, which is why
		// the service refuses a rejection that has none.
		const row = rowFor(page, SEED_VOL_LOG_REJECTED_DESC);
		await expect(row).toBeVisible({ timeout: 15000 });
		await expect(row).toContainText(SEED_VOL_REJECTED_REASON);
	});

	test('a member can log hours and they land as pending', async ({ page }) => {
		await login(page, SEED_VOL_MEMBER_EMAIL, SEED_VOL_MEMBER_PASSWORD);
		await page.goto('/member/volunteer');

		const description = `E2E logged ${Date.now()}`;
		await page.getByRole('button', { name: 'Log Hours' }).click();

		await page
			.locator('select[name="volunteerRoleId"]')
			.selectOption({ label: SEED_VOL_ROLE_NAME });
		await page.locator('input[name="hours"]').fill('1.5');
		await page.locator('textarea[name="description"]').fill(description);
		await page.getByRole('button', { name: 'Submit for review' }).click();

		const row = rowFor(page, description);
		await expect(row).toBeVisible({ timeout: 15000 });
		await expect(row).toContainText('1.5 hrs');
		// Editable only while pending — the controls are the proof of status.
		await expect(rowAction(row, 'Withdraw')).toBeVisible();
	});
});
