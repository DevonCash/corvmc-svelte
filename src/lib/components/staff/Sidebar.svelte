<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { SvelteComponent } from 'svelte';
	import { page } from '$app/state';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	type IconComponent = typeof SvelteComponent<any>;

	let {
		navItems,
		footer
	}: {
		navItems: { href: string; label: string; icon: IconComponent }[];
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
					<item.icon size={20} />
					{item.label}
				</a>
			</li>
		{/each}
	</ul>

	{#if footer}
		{@render footer()}
	{/if}
</aside>
