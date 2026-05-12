<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';

	let {
		navItems,
		footer
	}: {
		navItems: { href: string; label: string; icon: string }[];
		footer?: Snippet;
	} = $props();

	function isActive(href: string): boolean {
		if (href === '/staff') return page.url.pathname === '/staff';
		return page.url.pathname.startsWith(href);
	}
</script>

<aside class="bg-base-200 text-base-content flex h-full w-64 flex-col">
	<!-- Logo area -->
	<div class="flex items-center gap-2 px-6 py-5">
		<span class="text-xl font-bold">CorvMC</span>
		<span class="badge badge-sm badge-primary">Staff</span>
	</div>

	<!-- Nav links -->
	<ul class="menu flex-1 w-full">
		{#each navItems as item (item.href)}
			<li>
				<a href={item.href} class:active={isActive(item.href)}>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={item.icon} />
					</svg>
					{item.label}
				</a>
			</li>
		{/each}
	</ul>

	{#if footer}
		{@render footer()}
	{/if}
</aside>
