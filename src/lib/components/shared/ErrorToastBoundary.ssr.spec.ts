import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import Harness from './ErrorToastBoundarySsrHarness.svelte';

/**
 * A `<svelte:boundary>` that has a `pending` snippet renders that snippet during SSR
 * *instead of* awaiting its contents (see the Svelte async SSR docs). That is the right
 * trade for the authenticated panels — cheap TTFB, data fetched on hydrate — but it left
 * every public marketing page server-rendering nothing but a spinner, so crawlers and
 * link-preview scrapers saw an empty `<main>`.
 */
describe('ErrorToastBoundary server rendering', () => {
	it('renders the pending spinner instead of awaiting, by default', async () => {
		const { body } = await render(Harness);

		expect(body).toContain('loading loading-spinner loading-lg');
		expect(body).not.toContain('resolved content');
	});

	it('awaits and renders real content when showPending is false', async () => {
		const { body } = await render(Harness, { props: { showPending: false } });

		expect(body).toContain('resolved content');
		expect(body).not.toContain('loading loading-spinner loading-lg');
	});
});
