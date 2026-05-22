<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		children,
		class: className = ''
	}: {
		children: Snippet;
		class?: string;
	} = $props();
</script>

<div class="action-group {className}">
	{@render children()}
</div>

<style>
	.action-group {
		display: inline-flex;
	}

	.action-group > :global(.btn) {
		border-radius: 0;
	}

	.action-group > :global(.btn:first-child) {
		border-start-start-radius: var(--radius-field);
		border-end-start-radius: var(--radius-field);
	}

	.action-group > :global(.btn:last-child) {
		border-start-end-radius: var(--radius-field);
		border-end-end-radius: var(--radius-field);
	}

	.action-group > :global(.btn:not(:first-child)) {
		margin-inline-start: -2.5px;
	}
</style>
