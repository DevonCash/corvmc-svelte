<script lang="ts">
	import { page } from '$app/state';
	import { getMember } from '../../data.remote';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import ProfileLinks from '$lib/components/shared/ProfileLinks.svelte';
	import ProfileEmbeds from '$lib/components/shared/ProfileEmbeds.svelte';
	import type { DirectoryContact, ProfileLink } from '$lib/server/db/schema/auth';
	import Alert from '$lib/components/shared/Alert.svelte';
	import Badge from '$lib/components/shared/Badge.svelte';

	let id = $derived(page.params.id!);
	let member = $derived(await getMember(id));

	let links = $derived((member?.links as ProfileLink[] | null) ?? []);
	let contact = $derived((member?.directoryContact as DirectoryContact | null) ?? {});
	let hasContact = $derived(!!contact.email || !!contact.phone || !!contact.social);
</script>

	{#if member}
		<PageHeader title={member.name} subtitle="Member Profile" backHref="/member/directory" />
		<PageContent width="2xl">
			<!-- Header -->
			<div class="flex items-center gap-4">
				<div class="avatar placeholder">
					<div class="w-20 rounded-full bg-neutral text-neutral-content">
						{#if member.image}
							<img src={member.image} alt={member.name} class="rounded-full" />
						{:else}
							<span class="text-3xl">{member.name.charAt(0).toUpperCase()}</span>
						{/if}
					</div>
				</div>
				<div>
					<h2 class="text-xl font-bold">{member.name}</h2>
					{#if member.tagline}
						<p class="opacity-60">{member.tagline}</p>
					{/if}
					{#if member.lookingForBand}
						<Badge variant="primary" class="mt-1">Looking for a band</Badge>
					{/if}
				</div>
			</div>

			<!-- Bio -->
			{#if member.bio}
				<p class="text-base-content/80">{member.bio}</p>
			{/if}

			<!-- Instruments & Genres -->
			{#if member.instruments?.length || member.genres?.length}
				<div class="flex flex-wrap gap-4">
					{#if member.instruments?.length}
						<div>
							<p class="text-xs font-medium opacity-60 mb-1">Instruments</p>
							<div class="flex flex-wrap gap-1">
								{#each member.instruments as inst}
									<Badge variant="outline">{inst}</Badge>
								{/each}
							</div>
						</div>
					{/if}
					{#if member.genres?.length}
						<div>
							<p class="text-xs font-medium opacity-60 mb-1">Genres</p>
							<div class="flex flex-wrap gap-1">
								{#each member.genres as genre}
									<Badge variant="ghost">{genre}</Badge>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Contact Info -->
			{#if hasContact}
				<div>
					<h3 class="text-sm font-semibold mb-2">Contact</h3>
					<dl class="grid gap-x-4 gap-y-1 text-sm" style="grid-template-columns: auto 1fr;">
						{#if contact.email}
							<dt class="opacity-60">Email</dt>
							<dd><a href="mailto:{contact.email}" class="link">{contact.email}</a></dd>
						{/if}
						{#if contact.phone}
							<dt class="opacity-60">Phone</dt>
							<dd>{contact.phone}</dd>
						{/if}
						{#if contact.social}
							<dt class="opacity-60">Social</dt>
							<dd>{contact.social}</dd>
						{/if}
					</dl>
				</div>
			{/if}

			<!-- Links -->
			{#if links.length > 0}
				<div>
					<h3 class="text-sm font-semibold mb-2">Links</h3>
					<ProfileLinks {links} />
				</div>
			{/if}

			<!-- Embeds -->
			{#if links.length > 0}
				<ProfileEmbeds {links} />
			{/if}
		</PageContent>
	{:else}
		<Alert type="warning">
			Member not found or profile is hidden.
			{#snippet action()}
				<a href="/member/directory" class="btn btn-sm">Back to Directory</a>
			{/snippet}
		</Alert>
	{/if}


