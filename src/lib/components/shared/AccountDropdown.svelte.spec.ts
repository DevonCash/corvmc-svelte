import { page } from 'vitest/browser';
import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render } from 'vitest-browser-svelte';

// AccountDropdown awaits `getMe()` and resolves route paths — both require a live
// server/auth context at runtime. Mocking the two modules lets it render fully
// isolated: no DB, no session, no SvelteKit server. The vi.mock factory must
// inline its return value (vi.mock is hoisted above all imports).
vi.mock('$lib/remote/layout.remote', () => ({
	getMe: () =>
		Promise.resolve({ id: 'user-1', name: 'Jane Doe', email: 'jane@example.dev', image: null })
}));

vi.mock('$app/paths', () => ({
	resolve: (path: string) => path
}));

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------

// The import stays dynamic so it resolves after the `vi.mock` calls above, but
// it is hoisted out of the test bodies: on a cold `node_modules/.vite` cache the
// first import transforms the whole module graph, which blows the 5s per-test
// timeout if it happens inside an `it()`.
let AccountDropdown: typeof import('./AccountDropdown.svelte').default;

beforeAll(async () => {
	AccountDropdown = (await import('./AccountDropdown.svelte')).default;
});

describe('AccountDropdown', () => {
	it('renders the signed-in user and opens the menu', async () => {
		render(AccountDropdown);

		const trigger = page.getByRole('button', { name: 'Account menu' });
		await expect.element(trigger).toBeVisible();

		// Menu is collapsed until the trigger is clicked.
		await trigger.click();

		await expect.element(page.getByText('Jane Doe')).toBeVisible();
		await expect.element(page.getByText('jane@example.dev')).toBeVisible();
		await expect.element(page.getByRole('link', { name: 'Profile' })).toBeVisible();
	});
});
