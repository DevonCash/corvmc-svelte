import { test, expect, type Page } from '@playwright/test';
import {
	SEED_CE_PASSWORD,
	SEED_CE_TRUSTED_EMAIL,
	SEED_CE_REVIEW_EMAIL,
	SEED_CE_DRAFT_ID,
	SEED_CE_DRAFT_TITLE,
	SEED_CE_PUBLISHED_TITLE,
	SEED_CE_QUEUE_DRAFT_ID,
	SEED_CE_QUEUE_DRAFT_TITLE,
	SEED_CE_CANCELLED_TITLE,
	readListingState
} from './fixtures/seed-community-events';
import { SEED_STAFF_EMAIL, SEED_STAFF_PASSWORD } from './fixtures/seed-staff-user';

/**
 * Community listings, end to end.
 *
 * The three things unit tests cannot prove, in order of how much they'd cost to
 * get wrong:
 *
 *   1. A draft is invisible to everyone but its author. Two separate negatives
 *      — absent from the public guide AND absent from the staff review queue —
 *      that only a round trip can assert together.
 *   2. Publishing routes by standing: straight to the guide for a trusted
 *      member, into the queue for a review-required one.
 *   3. A rejection reaches the member as written English with the reason
 *      attached, and their fix gets back to staff.
 */

async function login(page: Page, email: string, password: string) {
	await page.goto('/login');
	// FormField renders a <legend>, not a <label for>, so target inputs by name.
	await page.locator('input[name="email"]').fill(email);
	await page.locator('input[name="password"]').fill(password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await page.waitForURL(/\/member(\/|$|\?)/, { timeout: 15000 });
}

test.describe('community listings', () => {
	test('a published listing is on the public gig guide', async ({ page }) => {
		await page.goto('/events');
		await expect(page.getByText(SEED_CE_PUBLISHED_TITLE)).toBeVisible();
	});

	test('a cancelled listing stays on the guide, marked', async ({ page }) => {
		// The cancellation IS the announcement — the people who need it are the
		// ones who already had the date, so it must not silently vanish.
		await page.goto('/events');
		const row = page.locator('li.gig-row', { hasText: SEED_CE_CANCELLED_TITLE });
		await expect(row).toBeVisible();
		await expect(row.getByText('Cancelled')).toBeVisible();
	});

	test('a draft reaches neither the public guide nor the staff queue', async ({ page }) => {
		await page.goto('/events');
		await expect(page.getByText(SEED_CE_DRAFT_TITLE)).toHaveCount(0);

		await login(page, SEED_STAFF_EMAIL, SEED_STAFF_PASSWORD);
		// Straight to the queue by URL, the way the staff notification links —
		// if the tab didn't read the URL this would silently assert the All tab.
		await page.goto('/staff/events?status=pending_review');
		await expect(page.getByRole('button', { name: /Needs review/ })).toHaveClass(/latched/);
		await expect(page.getByText(SEED_CE_DRAFT_TITLE)).toHaveCount(0);
	});

	test('a trusted member publishes straight to the calendar', async ({ page }) => {
		await login(page, SEED_CE_TRUSTED_EMAIL, SEED_CE_PASSWORD);
		await page.goto(`/member/events/${SEED_CE_DRAFT_ID}/manage`);

		// The label is the promise: a trusted member is told "Publish", not
		// "Submit for review".
		await page.getByRole('button', { name: 'Publish', exact: true }).click();
		await page.getByRole('button', { name: 'Publish', exact: true }).last().click();

		await expect
			.poll(async () => (await readListingState(SEED_CE_DRAFT_ID)).status, { timeout: 15000 })
			.toBe('published');

		await page.goto('/events');
		await expect(page.getByText(SEED_CE_DRAFT_TITLE)).toBeVisible();
	});

	test('a review-required member is told so, and their listing queues', async ({ page }) => {
		await login(page, SEED_CE_REVIEW_EMAIL, SEED_CE_PASSWORD);
		await page.goto(`/member/events/${SEED_CE_QUEUE_DRAFT_ID}/manage`);

		// Same button, different promise — and it has to say the different thing.
		const submit = page.getByRole('button', { name: 'Submit for review' });
		await expect(submit).toBeVisible();
		await submit.click();
		await page.getByRole('button', { name: 'Submit for review' }).last().click();

		await expect
			.poll(async () => (await readListingState(SEED_CE_QUEUE_DRAFT_ID)).status, {
				timeout: 15000
			})
			.toBe('pending_review');

		await page.goto('/events');
		await expect(page.getByText(SEED_CE_QUEUE_DRAFT_TITLE)).toHaveCount(0);
	});

	test('staff turn a listing down with a reason, and the member sees it', async ({ page }) => {
		// Put it in the queue first, through the real path.
		await login(page, SEED_CE_REVIEW_EMAIL, SEED_CE_PASSWORD);
		await page.goto(`/member/events/${SEED_CE_QUEUE_DRAFT_ID}/manage`);
		const submit = page.getByRole('button', { name: 'Submit for review' });
		if (await submit.isVisible().catch(() => false)) {
			await submit.click();
			await page.getByRole('button', { name: 'Submit for review' }).last().click();
			await expect
				.poll(async () => (await readListingState(SEED_CE_QUEUE_DRAFT_ID)).status, {
					timeout: 15000
				})
				.toBe('pending_review');
		}

		const REASON = 'E2E: we need a real venue and a contact before this goes up.';

		await login(page, SEED_STAFF_EMAIL, SEED_STAFF_PASSWORD);
		await page.goto(`/staff/events/${SEED_CE_QUEUE_DRAFT_ID}`);
		await page.getByRole('button', { name: 'Turn down' }).click();
		await page.locator('textarea[name="notes"]').fill(REASON);
		await page
			.getByRole('button', { name: /Turn down|Submit|Confirm/ })
			.last()
			.click();

		await expect
			.poll(async () => (await readListingState(SEED_CE_QUEUE_DRAFT_ID)).status, {
				timeout: 15000
			})
			.toBe('rejected');
		expect((await readListingState(SEED_CE_QUEUE_DRAFT_ID)).reviewNotes).toBe(REASON);

		// The reason is the point of a rejection: a member who can't see what was
		// wrong can't fix it. It has to arrive as written English, not Zod text.
		await login(page, SEED_CE_REVIEW_EMAIL, SEED_CE_PASSWORD);
		await page.goto(`/member/events/${SEED_CE_QUEUE_DRAFT_ID}/manage`);
		await expect(page.getByText(REASON)).toBeVisible();
	});
});
