<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';

	let {
		label,
		icon,
		childHrefs,
		children
	}: {
		label: string;
		icon?: Snippet;
		childHrefs: string[];
		children: Snippet;
	} = $props();

	const isOpen = $derived(childHrefs.some((href) => page.url.pathname.startsWith(href)));
</script>

<li>
	<span class="menu-dropdown-toggle" class:menu-dropdown-show={isOpen}>
		{@render icon?.()}
		{label}
	</span>
	{#if isOpen}
		<ul class="menu-dropdown menu-dropdown-show">
			{@render children()}
		</ul>
	{/if}
</li>
