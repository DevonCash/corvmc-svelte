<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		message = 'No items found.',
		actionLabel,
		actionHref,
		class: className = '',
		children
	}: {
		message?: string;
		actionLabel?: string;
		actionHref?: string;
		class?: string;
		children?: Snippet;
	} = $props();
</script>

<div class="py-12 text-center opacity-60 {className}">
	{#if children}
		{@render children()}
	{:else if actionLabel && actionHref}
		<p>{message}</p>
		<a href={actionHref} class="mt-2 inline-block link link-primary">{actionLabel}</a>
	{/if}
</div>
