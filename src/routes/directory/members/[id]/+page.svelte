<script lang="ts">
	import type { PageData } from './$types';
	import ProfileLinks from '$lib/components/shared/ProfileLinks.svelte';
	import ProfileEmbeds from '$lib/components/shared/ProfileEmbeds.svelte';

	let { data }: { data: PageData } = $props();
	const member = $derived(data.member);
	const contact = $derived(member.directoryContact ?? {});
	const hasContact = $derived(!!contact.email || !!contact.phone || !!contact.social);
</script>

<div class="max-w-2xl mx-auto space-y-6 p-6">
	<a href="/directory" class="link text-sm opacity-60">&larr; Back to Directory</a>

	<!-- Header -->
	<div class="flex items-center gap-4">
		<div class="avatar placeholder">
			<div class="bg-neutral text-neutral-content w-20 rounded-full">
				{#if member.image}
					<img src={member.image} alt={member.name} class="rounded-full" />
				{:else}
					<span class="text-3xl">{member.name.charAt(0).toUpperCase()}</span>
				{/if}
			</div>
		</div>
		<div>
			<h1 class="text-2xl font-bold">{member.name}</h1>
			{#if member.tagline}
				<p class="opacity-60">{member.tagline}</p>
			{/if}
			{#if member.pronouns}
				<p class="text-sm opacity-50">{member.pronouns}</p>
			{/if}
			{#if member.lookingForBand}
				<span class="badge badge-primary badge-sm mt-1">Looking for a band</span>
			{/if}
		</div>
	</div>

	{#if member.bio}
		<p class="text-base-content/80">{member.bio}</p>
	{/if}

	{#if member.instruments?.length || member.genres?.length}
		<div class="flex flex-wrap gap-4">
			{#if member.instruments?.length}
				<div>
					<p class="text-xs font-medium opacity-60 mb-1">Instruments</p>
					<div class="flex flex-wrap gap-1">
						{#each member.instruments as inst}
							<span class="badge badge-outline badge-sm">{inst}</span>
						{/each}
					</div>
				</div>
			{/if}
			{#if member.genres?.length}
				<div>
					<p class="text-xs font-medium opacity-60 mb-1">Genres</p>
					<div class="flex flex-wrap gap-1">
						{#each member.genres as genre}
							<span class="badge badge-ghost badge-sm">{genre}</span>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}

	{#if hasContact}
		<div>
			<h2 class="text-sm font-semibold mb-2">Contact</h2>
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

	{#if member.links.length > 0}
		<div>
			<h2 class="text-sm font-semibold mb-2">Links</h2>
			<ProfileLinks links={member.links} />
		</div>

		<ProfileEmbeds links={member.links} />
	{/if}
</div>
