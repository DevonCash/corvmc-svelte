<script lang="ts">
	import type { PageServerData } from './$types';
	import TabBar from '$lib/components/shared/TabBar.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';

	let { data }: { data: PageServerData } = $props();

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
			<EmptyState message="No members yet." />
		{:else}
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
				{#each members as member (member.id)}
					<div class="card bg-base-100 shadow-sm">
						<div class="card-body items-center px-3 py-4 text-center">
							<div class="placeholder avatar">
								<div class="w-12 rounded-full bg-neutral text-neutral-content">
									{#if member.image}
										<img src={member.image} alt={member.name} class="rounded-full" />
									{:else}
										<span class="text-lg">{member.name.charAt(0).toUpperCase()}</span>
									{/if}
								</div>
							</div>
							<p class="mt-1 text-sm font-medium">{member.name}</p>
							{#if member.pronouns}
								<p class="text-xs opacity-60">{member.pronouns}</p>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}

	{#if activeTab === 'bands'}
		{#if bands.length === 0}
			<EmptyState message="No bands yet." />
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
								<div class="min-w-0">
									<p class="font-medium">{b.name}</p>
									<p class="text-xs opacity-60">
										{b.memberCount} member{b.memberCount === 1 ? '' : 's'}
									</p>
								</div>
							</div>
							{#if b.bio}
								<p class="mt-2 text-sm opacity-70">{b.bio}</p>
							{/if}
						</div>
					</a>
				{/each}
			</div>
		{/if}
	{/if}
</div>
