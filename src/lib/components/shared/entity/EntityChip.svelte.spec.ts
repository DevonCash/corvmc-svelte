import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Harness from './EntityChipHarness.svelte';
import { fakeRef } from '$lib/test/fixtures';

describe('EntityChip', () => {
	it('derives its link from the viewer rather than a prop', async () => {
		render(Harness, { ref: fakeRef('member', { id: 'm1' }), panel: 'staff', isStaff: true });
		expect(document.querySelector('a')?.getAttribute('href')).toBe('/staff/users/m1');
	});

	/**
	 * Unreachable keeps the chip shape, so a list of chips stays a list of chips
	 * rather than collapsing into bare text where one entry happens to be gone.
	 * No `href="#"`, which would leave a dead anchor in the accessibility tree.
	 */
	it('renders a span, not a dead anchor, when there is no page to open', async () => {
		render(Harness, { ref: fakeRef('flag', { id: 'f1' }), isStaff: false, panel: 'member' });
		expect(document.querySelector('a')).toBeNull();
		expect(document.body.textContent).toContain('The Velvet Underground');
	});

	/**
	 * A chip's leading glyph is identity, never a subtype: a band-booked
	 * reservation drawn with a music note reads as *a band*.
	 */
	it('shows the type glyph even for a marked subtype', async () => {
		render(Harness, { ref: fakeRef('reservation', { id: 'r1', subtype: 'band' }) });
		const svgs = document.querySelectorAll('a svg');
		expect(svgs.length).toBe(1);
	});

	describe('status', () => {
		it('trails a glyph when the record needs attention', async () => {
			render(Harness, { ref: fakeRef('event', { id: 'e1', status: 'cancelled' }) });
			expect(document.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('Cancelled');
		});

		it('says nothing for a record in its expected state', async () => {
			render(Harness, { ref: fakeRef('event', { id: 'e1', status: 'published' }) });
			expect(document.querySelector('[role="img"]')).toBeNull();
		});

		it('can be turned off entirely', async () => {
			render(Harness, {
				ref: fakeRef('event', { id: 'e1', status: 'cancelled' }),
				status: false
			});
			expect(document.querySelector('[role="img"]')).toBeNull();
		});
	});
});
