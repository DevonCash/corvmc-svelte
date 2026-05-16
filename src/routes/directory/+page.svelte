<script lang="ts">
	import TabBar from '$lib/components/shared/TabBar.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';

	let { data }: { data: any } = $props();

	const members = $derived(data.members);
	const bands = $derived(data.bands);

	let activeTab = $state<'members' | 'bands'>('members');
</script>

<div class="mx-auto max-w-4xl space-y-6 p-6">
	<h1 class="text-2xl font-bold">Directory</h1>

	<TabBar
		tabs={[
			{ key: 'members', label: `Members (${members.length})` },
			{ key: 'bands', label: `Bands (${bands.length})` }
		]}
		active={activeTab}
		onchange={(key) => (activeTab = key as 'members' | 'bands')}
	/>

	{#if activeTab === 'members'}
		{#if members.length === 0}
			<EmptyState message="No public member profiles yet." />
		{:else}
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
				{#each members as member (member.id)}
					<a
						href="/directory/members/{member.id}"
						class="card bg-base-100 shadow-sm transition-shadow hover:shadow-md"
					>
						<div class="card-body py-4">
							<div class="flex items-center gap-3">
								<div class="placeholder avatar">
									<div class="w-12 rounded-full bg-neutral text-neutral-content">
										{#if member.image}
											<img src={member.image} alt={member.name} class="rounded-full" />
										{:else}
											<span class="text-lg">{member.name.charAt(0).toUpperCase()}</span>
										{/if}
									</div>
								</div>
								<div class="min-w-0 flex-1">
									<p class="font-medium truncate">{member.name}</p>
									{#if member.tagline}
										<p class="text-sm opacity-60 truncate">{member.tagline}</p>
									{:else if member.pronouns}
										<p class="text-xs opacity-60">{member.pronouns}</p>
									{/if}
								</div>
								{#if member.lookingForBand}
									<span class="badge badge-primary badge-sm whitespace-nowrap">Looking for band</span>
								{/if}
							</div>
							{#if member.instruments?.length || member.genres?.length}
								<div class="flex flex-wrap gap-1 mt-2">
									{#each (member.instruments ?? []).slice(0, 3) as inst}
										<span class="badge badge-outline badge-xs">{inst}</span>
									{/each}
									{#each (member.genres ?? []).slice(0, 3) as genre}
										<span class="badge badge-ghost badge-xs">{genre}</span>
									{/each}
								</div>
							{/if}
						</div>
					</a>
				{/each}
			</div>
		{/if}
	{/if}

	{#if activeTab === 'bands'}
		{#if bands.length === 0}
			<EmptyState message="No public band profiles yet." />
		{:else}
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
				{#each bands as b (b.id)}
					<a
						href="/directory/bands/{b.slug}"
						class="card bg-base-100 shadow-sm transition-shadow hover:shadow-md"
					>
						<div class="card-body py-4">
							<div class="flex items-center gap-3">
								<div class="placeholder avatar">
									<div class="w-10 rounded-full bg-neutral text-neutral-content">
										{#if b.avatarUrl}
											<img src={b.avatarUrl} alt={b.name} class="rounded-full" />
										{:else}
											<span>{b.name.charAt(0).toUpperCase()}</span>
										{/if}
									</div>
								</div>
								<div class="min-w-0 flex-1">
									<p class="font-medium">{b.name}</p>
									{#if b.tagline}
										<p class="text-sm opacity-60 truncate">{b.tagline}</p>
									{:else}
										<p class="text-xs opacity-60">
											{b.memberCount} member{b.memberCount === 1 ? '' : 's'}
										</p>
									{/if}
								</div>
								{#if b.lookingForMembers}
									<span class="badge badge-primary badge-sm whitespace-nowrap">Recruiting</span>
								{/if}
							</div>
							{#if b.genres?.length}
								<div class="flex flex-wrap gap-1 mt-2">
									{#each b.genres.slice(0, 4) as genre}
										<span class="badge badge-ghost badge-xs">{genre}</span>
									{/each}
								</div>
							{:else if b.bio}
								<p class="mt-2 text-sm opacity-70">{b.bio}</p>
							{/if}
						</div>
					</a>
				{/each}
			</div>
		{/if}
	{/if}
</div>
