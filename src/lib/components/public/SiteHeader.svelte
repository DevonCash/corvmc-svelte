<script lang="ts">
	import { page } from '$app/state';
	import favicon from '$lib/assets/favicon.svg';

	let { user }: { user: { name: string } | null } = $props();

	let menuOpen = $state(false);

	const links = [
		{ href: '/about', label: 'About' },
		{ href: '/programs', label: 'Programs' },
		{ href: '/events', label: 'Events' },
		{ href: '/directory', label: 'Directory' },
		{ href: '/contribute', label: 'Contribute' },
		{ href: '/contact', label: 'Contact' }
	];

	function isActive(href: string): boolean {
		return page.url.pathname === href || page.url.pathname.startsWith(href + '/');
	}
</script>

<header>
	<nav class="navbar bg-base-100 border-b border-base-300 px-4 py-2">
		<div class="flex-1 flex items-center gap-4">
			<a href="/" class="flex items-center gap-2 text-lg font-bold">
				<img src={favicon} alt="" class="w-8 h-8" />
				CorvMC
			</a>

			<div class="hidden lg:flex items-center gap-1">
				{#each links as link}
					<a
						href={link.href}
						class="btn btn-sm btn-ghost {isActive(link.href) ? 'btn-active' : ''}"
					>
						{link.label}
					</a>
				{/each}
			</div>
		</div>

		<div class="flex-none flex items-center gap-2">
			{#if user}
				<a href="/member" class="btn btn-sm btn-primary">My Account</a>
			{:else}
				<a href="/login" class="btn btn-sm btn-primary">Sign In</a>
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
	</nav>

	{#if menuOpen}
		<div class="lg:hidden border-b border-base-300 bg-base-100">
			<ul class="menu menu-sm p-2">
				{#each links as link}
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
