<script lang="ts">
	import { IconBrandFacebook, IconBrandInstagram } from '@tabler/icons-svelte';
	import { getSocialLinks } from '$lib/remote/settings.remote';

	let socialLinks = $derived(await getSocialLinks());

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

	const socials = $derived(
		[
			{ href: socialLinks.facebook, label: 'Facebook', icon: IconBrandFacebook },
			{ href: socialLinks.instagram, label: 'Instagram', icon: IconBrandInstagram }
		].filter((s) => s.href)
	);
</script>

<footer
	class="mt-16"
	style="background: var(--bg-section); border-top: 1px solid var(--surface-border)"
>
	<div class="tri-stripe"></div>
	<div class="max-w-3xl mx-auto px-4 py-12 text-center">
		<div class="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-medium">
			{#each footerLinks as link}
				<a href={link.href} class="link link-hover">{link.label}</a>
			{/each}
		</div>

		{#if socials.length > 0}
			<div class="flex justify-center gap-4 mt-6">
				{#each socials as social}
					<a
						href={social.href}
						aria-label={social.label}
						class="opacity-60 hover:opacity-100 transition-opacity"
					>
						<social.icon size={22} />
					</a>
				{/each}
			</div>
		{/if}

		<div class="mt-6 text-xs" style="color: var(--fg-3)">
			<p>&copy; {new Date().getFullYear()} Corvallis Music Collective. All rights reserved.</p>
			<p class="mt-1">501(c)(3) Nonprofit &middot; 6775 SW Philomath Blvd, Corvallis, OR</p>
		</div>
	</div>
</footer>
