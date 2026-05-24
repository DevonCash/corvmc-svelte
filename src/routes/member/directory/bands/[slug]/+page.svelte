<script lang="ts">
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import ProfileLinks from '$lib/components/shared/directory/ProfileLinks.svelte';
	import ProfileEmbeds from '$lib/components/shared/directory/ProfileEmbeds.svelte';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import Badge from '$lib/components/shared/Badge.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const band = $derived(data.band);
	const members = $derived(data.members);
	const contact = $derived(band.directoryContact ?? {});
	const hasContact = $derived(!!contact.email || !!contact.phone || !!contact.social);
</script>

<PageHeader title={band.name} backHref="/member/directory" />
<PageContent width="2xl">
	<!-- Band header -->
	<div class="flex items-center gap-4">
		<div class="avatar placeholder">
			<div class="bg-neutral text-neutral-content w-16 rounded-full">
				{#if band.avatarUrl}
					<img src={band.avatarUrl} alt={band.name} class="rounded-full" />
				{:else}
					<span class="text-2xl">{band.name.charAt(0).toUpperCase()}</span>
				{/if}
			</div>
		</div>
		<div>
			{#if band.tagline}
				<p class="opacity-60">{band.tagline}</p>
			{:else}
				<p class="text-sm opacity-60">
					{band.memberCount} member{band.memberCount === 1 ? '' : 's'}
				</p>
			{/if}
			{#if band.lookingForMembers}
				<Badge variant="primary" class="mt-1">Looking for members</Badge>
			{/if}
		</div>
	</div>

	{#if band.bio}
		<p class="text-base-content/80">{band.bio}</p>
	{/if}

	{#if band.genres?.length}
		<div>
			<p class="text-xs font-medium opacity-60 mb-1">Genres</p>
			<div class="flex flex-wrap gap-1">
				{#each band.genres as genre}
					<Badge variant="ghost">{genre}</Badge>
				{/each}
			</div>
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

	{#if band.links && band.links.length > 0}
		<div>
			<h2 class="text-sm font-semibold mb-2">Links</h2>
			<ProfileLinks links={band.links} />
		</div>

		<ProfileEmbeds links={band.links} />
	{/if}

	<!-- Members -->
	<section>
		<h2 class="text-lg font-semibold mb-3">Members</h2>
		<div class="space-y-2">
			{#each members as member (member.id)}
				<div class="card bg-base-100 shadow-sm">
					<div class="card-body py-3 flex-row items-center justify-between">
						<div class="flex items-center gap-3">
							<div class="avatar placeholder">
								<div class="bg-neutral text-neutral-content w-8 rounded-full">
									{#if member.userImage}
										<img src={member.userImage} alt={member.userName} class="rounded-full" />
									{:else}
										<span class="text-xs">{member.userName.charAt(0).toUpperCase()}</span>
									{/if}
								</div>
							</div>
							<div>
								<p class="font-medium">{member.userName}</p>
								{#if member.position}
									<p class="text-xs opacity-60">{member.position}</p>
								{/if}
							</div>
						</div>
						<StatusBadge status={member.role} />
					</div>
				</div>
			{/each}
		</div>
	</section>
</PageContent>
