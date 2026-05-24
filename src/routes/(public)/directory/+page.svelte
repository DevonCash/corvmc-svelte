<script lang="ts">
	import TabBar from '$lib/components/shared/TabBar.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import IdCard from '$lib/components/shared/directory/IdCard.svelte';
	import VinylCard from '$lib/components/shared/directory/VinylCard.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const members = $derived(data.members);
	const bands = $derived(data.bands);

	let activeTab = $state<'members' | 'bands'>('members');

	const bandColors = ['#e5771e', '#003b5c', '#00859b', '#f84d13', '#ffb500', '#5a3d2b'];
</script>

<svelte:head>
	<title>Directory | Corvallis Music Collective</title>
	<meta name="description" content="Musicians and bands in the Corvallis Music Collective." />
</svelte:head>

<section class="py-16 px-6">
	<div class="max-w-5xl mx-auto">
		<div class="text-center mb-8">
			<h1 class="text-4xl font-bold tracking-tight mb-3" style="color: var(--cmc-navy)">Directory</h1>
			<p class="text-base" style="color: var(--fg-2)">Musicians and bands in the Corvallis Music Collective</p>
		</div>

		<div class="flex justify-center mb-10">
			<TabBar
				tabs={[
					{ key: 'members', label: `Musicians (${members.length})` },
					{ key: 'bands', label: `Bands (${bands.length})` }
				]}
				active={activeTab}
				onchange={(key) => (activeTab = key as 'members' | 'bands')}
			/>
		</div>

		{#if activeTab === 'members'}
			{#if members.length === 0}
				<EmptyState message="No public member profiles yet." />
			{:else}
				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center">
					{#each members as member (member.id)}
						<IdCard
							href="/directory/members/{member.id}"
							name={member.name}
							image={member.image}
							pronouns={member.pronouns}
							tagline={member.tagline}
							instruments={member.instruments}
							genres={member.genres}
							bands={member.bands}
							lookingForBand={member.lookingForBand}
							memberSince={new Date(member.memberSince).getFullYear()}
						/>
					{/each}
				</div>
			{/if}
		{/if}

		{#if activeTab === 'bands'}
			{#if bands.length === 0}
				<EmptyState message="No public band profiles yet." />
			{:else}
				<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 justify-items-center">
					{#each bands as b, i (b.id)}
						<VinylCard
							href="/directory/bands/{b.slug}"
							id={b.id}
							name={b.name}
							avatarUrl={b.avatarUrl}
							tagline={b.tagline}
							memberCount={b.memberCount}
							lookingForMembers={b.lookingForMembers}
							color={bandColors[i % bandColors.length]}
						/>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
</section>
