<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		width = 'full',
		class: className = '',
		children
	}: {
		width?: 'full' | 'md' | '2xl' | '3xl';
		class?: string;
		children: Snippet;
	} = $props();

	const widthClass = $derived(
		width === 'full' ? '' : `max-w-screen-${width} mx-auto`
	);
</script>

<div class="space-y-6 {widthClass} {className}">
	{@render children()}
</div>
