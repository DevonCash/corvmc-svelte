<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';

	let { href, label, icon }: {
		href: string;
		label: string;
		icon?: Snippet;
	} = $props();

	let active = $derived(page.url.pathname === href || page.url.pathname.startsWith(href + '/'));
</script>

<li>
	<a {href} class:active>
		{@render icon?.()}
		{label}
	</a>
</li>

<style>
	a :global(svg) {
		width: 20px;
		height: 20px;
	}
</style>
