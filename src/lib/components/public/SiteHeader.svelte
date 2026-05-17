<script lang="ts">
	import { page } from '$app/state';
	import Logo from '$lib/components/shared/Logo.svelte';

	let { user }: { user: { name: string } | null } = $props();

	let menuOpen = $state(false);

	const links = [
		{ href: '/events', label: 'Events' },
		{ href: '/directory', label: 'Directory' },
		{ href: '/programs', label: 'Programs' },
		{ href: '/about', label: 'About' }
	];

	function isActive(href: string): boolean {
		return page.url.pathname === href || page.url.pathname.startsWith(href + '/');
	}
</script>

<header>
	<nav class="px-4 py-3" style="background: var(--bg-page); border-bottom: 1px solid var(--surface-border)">
		<div class="max-w-6xl mx-auto grid items-end gap-x-4 gap-y-1" style="grid-template-columns: auto 1fr auto; grid-template-rows: auto auto">
			<!-- Logo -->
			<a href="/" class="row-span-2 flex items-center" style="height: 72px">
				<Logo soundLines={false} class="h-full w-auto" />
			</a>

			<!-- Title -->
			<div class="text-2xl font-bold" style="color: var(--cmc-teal); grid-row: 1; grid-column: 2">
				Corvallis Music Collective
			</div>

			<!-- Actions -->
			<div class="flex items-center gap-2" style="grid-row: 1 / 3; grid-column: 3">
				{#if user}
					<a href="/member" class="btn btn-sm btn-primary retro-btn">My Account</a>
				{:else}
					<a href="/login" class="btn btn-sm btn-primary retro-btn">Sign In</a>
				{/if}
				<button
					class="btn btn-sm btn-ghost lg:hidden"
					onclick={() => (menuOpen = !menuOpen)}
					aria-label="Toggle menu"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
					</svg>
				</button>
			</div>

			<!-- Nav -->
			<nav class="hidden lg:flex items-center gap-1 -ml-3" style="grid-row: 2; grid-column: 2">
				{#each links as link}
					<a
						href={link.href}
						class="px-3 py-2 rounded-md text-sm font-medium transition-colors"
						class:is-active={isActive(link.href)}
						style={isActive(link.href)
							? 'background: color-mix(in oklch, var(--cmc-orange) 14%, transparent); color: var(--cmc-orange)'
							: ''}
					>
						{link.label}
					</a>
				{/each}
				<a
					href="/contribute"
					class="btn btn-sm btn-outline retro-btn ml-3"
					style="--btn-fill: var(--bg-page)"
				>
					Contribute
				</a>
			</nav>
		</div>
	</nav>

	{#if menuOpen}
		<div class="lg:hidden" style="border-bottom: 1px solid var(--surface-border); background: var(--bg-page)">
			<ul class="menu menu-sm p-2">
				{#each [...links, { href: '/contribute', label: 'Contribute' }, { href: '/contact', label: 'Contact' }] as link}
					<li>
						<a
							href={link.href}
							class:active={isActive(link.href)}
							onclick={() => (menuOpen = false)}
						>
							{link.label}
						</a>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<div class="tri-stripe"></div>
</header>

<style>
	nav a:not(.btn):hover {
		background: color-mix(in oklch, var(--cmc-orange) 10%, transparent);
	}
</style>
