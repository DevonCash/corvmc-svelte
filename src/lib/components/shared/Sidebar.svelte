<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { SvelteComponent } from 'svelte';
	import { page } from '$app/state';
	import NavItem from './NavItem.svelte';
	import NavGroup from './NavGroup.svelte';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	type IconComponent = typeof SvelteComponent<any>;

	interface INavItem {
		href: string;
		label: string;
		icon: IconComponent;
	}

	interface INavGroup {
		label: string;
		icon: IconComponent;
		children: INavItem[];
	}

	function isNavItem(item: INavItem | INavGroup): item is INavItem {
		return (item as INavItem).href !== undefined;
	}

	let {
		navItems,
		title = 'CorvMC',
		badge = 'Staff',
		footer,
		navigation,
		brand
	}: {
		// @deprecated navItems prop, will be removed in favor of using the navigation slot exclusively
		navItems: (INavItem | INavGroup)[] | null;
		title?: string;
		badge?: string;
		footer?: Snippet;
		navigation?: Snippet;
		brand?: Snippet;
	} = $props();

	function isActive(href: string, index: number): boolean {
		// First nav item (dashboard) uses exact match to avoid false positives
		if (index === 0) return page.url.pathname === href;
		return page.url.pathname.startsWith(href);
	}
</script>

<aside class="flex h-full w-64 flex-col bg-base-200 text-base-content">
	<!-- Logo area -->
	{#if brand}
		{@render brand()}
	{:else}
		<div class="flex items-center gap-2 px-6 py-5">
			<span class="truncate text-xl font-bold">{title}</span>
			<span class="badge badge-sm badge-primary">{badge}</span>
		</div>
	{/if}

	<div class="tri-stripe"></div>

	<!-- Nav links -->
	<ul class="menu w-full flex-1">
		{@render navigation?.()}
		{#each navItems as item, i (item.label)}
			{#if isNavItem(item)}
				<NavItem href={item.href} label={item.label}>
					{#snippet icon()}<item.icon size={20} />{/snippet}
				</NavItem>
			{:else}
				<NavGroup label={item.label} icon={item.icon}>
					{#each item.children as child, j (child.label)}
						<NavItem href={child.href} label={child.label}>
							{#snippet icon()}<child.icon size={20} />{/snippet}
						</NavItem>
					{/each}
				</NavGroup>
			{/if}
		{/each}
	</ul>

	{#if footer}
		{@render footer()}
	{/if}
</aside>
