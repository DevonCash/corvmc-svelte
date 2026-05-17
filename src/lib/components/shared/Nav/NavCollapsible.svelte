<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';

	let {
		href,
		label,
		icon,
		childHrefs,
		children
	}: {
		href: string;
		label: string;
		icon?: Snippet;
		childHrefs: string[];
		children: Snippet;
	} = $props();

	let isOpen = $derived(childHrefs.some((href) => page.url.pathname.startsWith(href)));
	let active = $derived(page.url.pathname === href );
</script>

<li>
	<a {href} class:active>
		{@render icon?.()}
		{label}
	</a>
	{#if isOpen}
		<ul class="menu-dropdown menu-dropdown-show">
			{@render children()}
		</ul>
	{/if}
</li>

<style>
	a :global(svg) {
		width: 20px;
		height: 20px;
	}

	a.active {
		background: oklch(from var(--color-primary) l c h / 30%);
	}
</style>
