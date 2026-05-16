<script lang="ts">
	import { IconBrandFacebook, IconBrandInstagram } from '@tabler/icons-svelte';

	const footerLinks = [
		{ href: '/about', label: 'About' },
		{ href: '/programs', label: 'Programs' },
		{ href: '/events', label: 'Events' },
		{ href: '/directory', label: 'Directory' },
		{ href: '/contribute', label: 'Contribute' },
		{ href: '/about/bylaws', label: 'Bylaws' },
		{ href: '/about/privacy', label: 'Privacy' },
		{ href: '/contact', label: 'Contact' }
	];
</script>

<footer class="mt-16" style="background: var(--bg-section); border-top: 1px solid var(--surface-border)">
	<div class="tri-stripe"></div>
	<div class="max-w-3xl mx-auto px-4 py-12 text-center">
		<div class="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-medium">
			{#each footerLinks as link}
				<a href={link.href} class="link link-hover">{link.label}</a>
			{/each}
		</div>

		<div class="flex justify-center gap-4 mt-6">
			<a href="https://facebook.com" aria-label="Facebook" class="opacity-60 hover:opacity-100 transition-opacity">
				<IconBrandFacebook size={22} />
			</a>
			<a href="https://instagram.com" aria-label="Instagram" class="opacity-60 hover:opacity-100 transition-opacity">
				<IconBrandInstagram size={22} />
			</a>
		</div>

		<div class="mt-6 text-xs" style="color: var(--fg-3)">
			<p>&copy; {new Date().getFullYear()} Corvallis Music Collective. All rights reserved.</p>
			<p class="mt-1">501(c)(3) Nonprofit &middot; 6775 SW Philomath Blvd, Corvallis, OR</p>
		</div>
	</div>
</footer>
