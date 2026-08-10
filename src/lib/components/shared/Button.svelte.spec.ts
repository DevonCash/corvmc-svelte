import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ButtonHarness from './Button.test.svelte';

/**
 * `title` renders the button inside a bits-ui `Tooltip.Trigger`, which defaults
 * to rendering its own `<button>`. That produced `<button><button>…</button></button>`
 * for every icon-only Action in the app: invalid HTML, a duplicate tab stop, and —
 * because the accessibility tree does not expose an interactive descendant of a
 * button — a control that vanished from the a11y tree despite a correct aria-label.
 * The trigger must merge its props onto the button instead of wrapping it.
 */

const nested = () => document.querySelectorAll('button button, button a, a button, a a');

describe('Button with a tooltip', () => {
	it('does not nest an interactive element inside another', async () => {
		render(ButtonHarness, { title: 'Save changes', label: 'Save' });

		await expect.element(page.getByRole('button', { name: 'Save' })).toBeInTheDocument();
		expect(nested()).toHaveLength(0);
	});

	it('renders an href button as a single anchor', async () => {
		render(ButtonHarness, { title: 'Go home', href: '/', label: 'Home' });

		await expect.element(page.getByRole('link', { name: 'Home' })).toBeInTheDocument();
		expect(nested()).toHaveLength(0);
	});

	it('keeps the caller onclick when the tooltip trigger adds its own', async () => {
		const onclick = vi.fn();
		render(ButtonHarness, { title: 'Save changes', label: 'Save', onclick });

		await page.getByRole('button', { name: 'Save' }).click();
		expect(onclick).toHaveBeenCalledOnce();
	});

	it('shows the tooltip on hover', async () => {
		render(ButtonHarness, { title: 'Save changes', label: 'Save' });

		await page.getByRole('button', { name: 'Save' }).hover();
		await expect.element(page.getByText('Save changes')).toBeVisible();
	});
});
