<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		children,
		vertical = false,
		class: className = '',
		style = ''
	}: {
		children: Snippet;
		vertical?: boolean;
		class?: string;
		style?: string;
	} = $props();
</script>

<div class="action-group {className}" class:vertical {style}>
	{@render children()}
</div>

<style>
	.action-group {
		display: inline-flex;
	}

	.action-group > :global(.btn) {
		border-radius: 0;
		position: relative;
	}

	/* Horizontal (default) */
	.action-group:not(.vertical) > :global(.btn:first-child) {
		border-start-start-radius: var(--radius-field);
		border-end-start-radius: var(--radius-field);
	}

	.action-group:not(.vertical) > :global(.btn:last-child) {
		border-start-end-radius: var(--radius-field);
		border-end-end-radius: var(--radius-field);
	}

	.action-group:not(.vertical) > :global(.btn:not(:first-child)) {
		margin-inline-start: -2.5px;
	}

	/* Vertical */
	.action-group.vertical {
		flex-direction: column;
	}

	.action-group.vertical > :global(.btn:first-child) {
		border-start-start-radius: var(--radius-field);
		border-start-end-radius: var(--radius-field);
	}

	.action-group.vertical > :global(.btn:last-child) {
		border-end-start-radius: var(--radius-field);
		border-end-end-radius: var(--radius-field);
	}

	.action-group.vertical > :global(.btn:not(:first-child)) {
		margin-block-start: -2.5px;
	}

	/* Horizontal: leftmost on top */
	.action-group:not(.vertical) > :global(.btn:nth-last-child(5)) { z-index: 5; }
	.action-group:not(.vertical) > :global(.btn:nth-last-child(4)) { z-index: 4; }
	.action-group:not(.vertical) > :global(.btn:nth-last-child(3)) { z-index: 3; }
	.action-group:not(.vertical) > :global(.btn:nth-last-child(2)) { z-index: 2; }
	.action-group:not(.vertical) > :global(.btn:nth-last-child(1)) { z-index: 1; }

	/* Vertical: bottommost on top */
	.action-group.vertical > :global(.btn:nth-child(1)) { z-index: 1; }
	.action-group.vertical > :global(.btn:nth-child(2)) { z-index: 2; }
	.action-group.vertical > :global(.btn:nth-child(3)) { z-index: 3; }
	.action-group.vertical > :global(.btn:nth-child(4)) { z-index: 4; }
	.action-group.vertical > :global(.btn:nth-child(5)) { z-index: 5; }
</style>
