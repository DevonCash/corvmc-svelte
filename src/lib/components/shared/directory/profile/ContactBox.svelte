<script lang="ts">
	import ProfileSection from './ProfileSection.svelte';
	import { IconMail, IconPhone, IconAt } from '@tabler/icons-svelte';
	import type { DirectoryContact } from '$lib/server/db/schema/authentication';

	let {
		label,
		contact,
		cta
	}: {
		label: 'Contact' | 'Booking';
		contact: DirectoryContact | null | undefined;
		/** primary email CTA — "Email via CMC" / "Email booking" */
		cta: { label: string; href: string };
	} = $props();

	const c = $derived(contact ?? {});
	const hasAny = $derived(!!c.email || !!c.phone || !!c.social);
</script>

{#if hasAny}
	<ProfileSection title={label} note={label === 'Booking' ? 'public' : 'members-only'}>
		<div class="contact">
			{#if c.email}
				<a href="mailto:{c.email}" class="contact__row">
					<IconMail size={16} />
					<span>{c.email}</span>
				</a>
			{/if}
			{#if c.phone}
				<a href="tel:{c.phone}" class="contact__row">
					<IconPhone size={16} />
					<span>{c.phone}</span>
				</a>
			{/if}
			{#if c.social}
				<span class="contact__row">
					<IconAt size={16} />
					<span>{c.social}</span>
				</span>
			{/if}
			{#if cta.href}
				<a href={cta.href} class="btn btn-primary btn-sm contact__cta">{cta.label}</a>
			{/if}
		</div>
	</ProfileSection>
{/if}

<style>
	.contact {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.contact__row {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--fg-1);
		text-decoration: none;
	}
	a.contact__row:hover {
		color: var(--color-primary);
	}
	.contact__cta {
		margin-top: 4px;
		align-self: flex-start;
	}
</style>
