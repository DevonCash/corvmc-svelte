import { expect, test, type Page } from '@playwright/test';
import { SEED_STAFF_EMAIL, SEED_STAFF_PASSWORD } from './fixtures/seed-staff-user';
import {
	SEED_EVENT_DATE,
	SEED_EVENT_END,
	SEED_EVENT_START,
	SEED_EVENT_TITLE_PREFIX
} from './fixtures/seed-staff-event';

/**
 * End-to-end pin for the "Reserve practice space" toggle on the New Event modal.
 *
 * The toggle's value was passed one-way (`value=` rather than `bind:value=`) to
 * FormField, whose checkbox owns the binding. The parent's `reserveSpace` never
 * flipped, so the conditional block holding the reservation times never mounted
 * and never submitted — and the server, which only booked the space when both
 * times arrived, created the event with no reservation and no error.
 *
 * This is the same FormField binding defect class documented in
 * staff-users.e2e.ts; only an e2e catches it, because the server handler tests
 * post the fields the browser was failing to render.
 */

async function loginAsStaff(page: Page) {
	await page.goto('/login');
	// FormField renders a <legend>, not a <label for>, so target inputs by name.
	await page.locator('input[name="email"]').fill(SEED_STAFF_EMAIL);
	await page.locator('input[name="password"]').fill(SEED_STAFF_PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await page.waitForURL(/\/member(\/|$|\?)/, { timeout: 15000 });
}

// A checkbox Field carries the `b:` prefix so SvelteKit submits a real boolean.
const RESERVE_TOGGLE = 'input[name="b:reserveSpace"]';

// The window and title prefix come from the fixture, which clears the previous
// run's event first — its reservation would otherwise conflict with this one.
const EVENT_DATE = SEED_EVENT_DATE;
const EVENT_START = SEED_EVENT_START;
const EVENT_END = SEED_EVENT_END;

test.describe('staff event creation — reserve space', () => {
	test('checking the toggle reveals the reservation times, pre-filled from the event', async ({
		page
	}) => {
		await loginAsStaff(page);
		await page.goto('/staff/events');
		await page.getByRole('button', { name: 'New Event' }).click();

		await page.locator('input[name="eventStartTime"]').fill(EVENT_START);
		await page.locator('input[name="eventEndTime"]').fill(EVENT_END);

		// Before the fix these never mounted, so the times were never submitted.
		await expect(page.locator('input[name="reservationStartTime"]')).toHaveCount(0);

		await page.locator(RESERVE_TOGGLE).check();

		await expect(page.locator('input[name="reservationStartTime"]')).toHaveValue(EVENT_START);
		await expect(page.locator('input[name="reservationEndTime"]')).toHaveValue(EVENT_END);
	});

	test('creating the event books the space and links it to the event', async ({ page }) => {
		await loginAsStaff(page);
		await page.goto('/staff/events');
		await page.getByRole('button', { name: 'New Event' }).click();

		const title = `${SEED_EVENT_TITLE_PREFIX} ${Date.now()}`;
		await page.locator('input[name="title"]').fill(title);
		await page.locator('input[name="eventDate"]').fill(EVENT_DATE);
		await page.locator('input[name="eventStartTime"]').fill(EVENT_START);
		await page.locator('input[name="eventEndTime"]').fill(EVENT_END);
		await page.locator(RESERVE_TOGGLE).check();

		await page.getByRole('button', { name: 'Create Event' }).click();

		// handleSuccess navigates to the new event's detail page.
		await page.waitForURL(/\/staff\/events\/[^/]+$/, { timeout: 15000 });
		await expect(page.getByRole('heading', { name: title })).toBeVisible();

		// The card only renders off `event.reservationId`, so its presence proves
		// the reservation was created AND linked.
		await expect(page.getByText('Space Reservation')).toBeVisible();
		await expect(page.getByRole('link', { name: /View reservation/ })).toBeVisible();
	});
});
