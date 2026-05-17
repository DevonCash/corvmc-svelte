<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';

	let { href, label, icon }: {
		href: string;
		label: string;
		icon?: Snippet;
	} = $props();

	let active = $derived(page.url.pathname === href);
</script>

<li>
	<a {href} class:active>
		{@render icon?.()}
		{label}
	</a>
</li>

<style lang='postcss'>
	a :global(svg) {
		width: 20px;
		height: 20px;
	}

	a.active {
		background: oklch(from var(--color-primary) l c h / 30%);
	}
</style>
