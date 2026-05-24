<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		children,
		vertical = false,
		wrap = false,
		class: className = '',
		style = ''
	}: {
		children: Snippet;
		vertical?: boolean;
		wrap?: boolean;
		class?: string;
		style?: string;
	} = $props();
</script>

<div class="button-group {className}" class:vertical class:wrap {style}>
	{@render children()}
</div>

<style>
	.button-group {
		display: inline-flex;
	}

	.button-group > :global(.btn) {
		border-radius: 0;
		position: relative;
		--shadow-color: var(--cmc-brown) !important;
		--shadow: 0;
	}

	/* Horizontal (default) */
	.button-group:not(.vertical):not(.wrap) > :global(.btn:first-child) {
		border-start-start-radius: var(--radius-field);
		border-end-start-radius: var(--radius-field);
	}

	.button-group:not(.vertical):not(.wrap) > :global(.btn:last-child) {
		border-start-end-radius: var(--radius-field);
		border-end-end-radius: var(--radius-field);
	}

	.button-group:not(.vertical):not(.wrap) > :global(.btn:not(:first-child)) {
		margin-inline-start: -2.5px;
	}

	/* Vertical */
	.button-group.vertical {
		flex-direction: column;
	}

	.button-group.vertical > :global(.btn:first-child) {
		border-start-start-radius: var(--radius-field);
		border-start-end-radius: var(--radius-field);
	}

	.button-group.vertical > :global(.btn:last-child) {
		border-end-start-radius: var(--radius-field);
		border-end-end-radius: var(--radius-field);
	}

	.button-group.vertical > :global(.btn:not(:first-child)) {
		margin-block-start: -2.5px;
	}

	/* Wrap — connected edges, flex-wrap for overflow */
	.button-group.wrap {
		flex-wrap: wrap;
	}

	.button-group.wrap > :global(.btn:not(:first-child)) {
		margin-inline-start: -2.5px;
	}

	.button-group.wrap > :global(.btn) {
		margin-block-end: -2.5px;
	}

	/* Horizontal (no wrap): leftmost on top */
	.button-group:not(.vertical):not(.wrap) > :global(.btn:nth-last-child(5)) { z-index: 5; }
	.button-group:not(.vertical):not(.wrap) > :global(.btn:nth-last-child(4)) { z-index: 4; }
	.button-group:not(.vertical):not(.wrap) > :global(.btn:nth-last-child(3)) { z-index: 3; }
	.button-group:not(.vertical):not(.wrap) > :global(.btn:nth-last-child(2)) { z-index: 2; }
	.button-group:not(.vertical):not(.wrap) > :global(.btn:nth-last-child(1)) { z-index: 1; }

	/* Vertical: bottommost on top */
	.button-group.vertical > :global(.btn:nth-child(1)) { z-index: 1; }
	.button-group.vertical > :global(.btn:nth-child(2)) { z-index: 2; }
	.button-group.vertical > :global(.btn:nth-child(3)) { z-index: 3; }
	.button-group.vertical > :global(.btn:nth-child(4)) { z-index: 4; }
	.button-group.vertical > :global(.btn:nth-child(5)) { z-index: 5; }
</style>
