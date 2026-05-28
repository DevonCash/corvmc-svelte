<script lang="ts">
	import { getDirectoryMembers, getDirectoryBands, getInstrumentSuggestions, getGenreSuggestions } from '$lib/remote/directory.remote';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import ButtonGroup from '$lib/components/shared/ButtonGroup.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import FreeformTagInput from '$lib/components/shared/FreeformTagInput.svelte';
	import IdCard from '$lib/components/shared/directory/IdCard.svelte';
	import VinylCard from '$lib/components/shared/directory/VinylCard.svelte';

	let activeTab = $state<'members' | 'bands'>('members');
	let search = $state('');
	let filterInstruments = $state<string[]>([]);
	let filterGenres = $state<string[]>([]);
	let lookingForBand = $state(false);
	let availableForHire = $state(false);
	let teachesLessons = $state(false);
	let lookingForMembers = $state(false);

	let filters = $derived({
		search: search || undefined,
		instruments: filterInstruments.length > 0 ? JSON.stringify(filterInstruments) : undefined,
		genres: filterGenres.length > 0 ? JSON.stringify(filterGenres) : undefined,
		lookingForBand: lookingForBand ? 'true' : undefined,
		availableForHire: availableForHire ? 'true' : undefined,
		teachesLessons: teachesLessons ? 'true' : undefined,
		lookingForMembers: lookingForMembers ? 'true' : undefined
	});

	let members = $derived(await getDirectoryMembers(filters));
	let bands = $derived(await getDirectoryBands(filters));
	let instrumentSuggestions = $derived(await getInstrumentSuggestions());
	let genreSuggestions = $derived(await getGenreSuggestions());

	const bandColors = ['#e5771e', '#003b5c', '#00859b', '#f84d13', '#ffb500', '#5a3d2b'];
</script>

<PageHeader title="Directory" subtitle="Community">
	<ButtonGroup>
		<button
			class="join-item btn btn-sm"
			class:btn-primary={activeTab === 'members'}
			class:latched={activeTab=="members"}
			onclick={() => (activeTab = 'members')}
		>
			Members ({members.length})
		</button>
		<button
			class="join-item btn btn-sm"
			class:btn-primary={activeTab === 'bands'}
			class:latched={activeTab === 'bands'}
			onclick={() => (activeTab = 'bands')}
		>
			Bands ({bands.length})
		</button>
	</ButtonGroup>
</PageHeader>
<PageContent>
	<!-- Search & Filters -->
	<div class="directory-filters">
		<div class="directory-filters__row">
			<input
				type="text"
				placeholder="Search by name..."
				class="input input-bordered flex-1"
				bind:value={search}
			/>
			{#if activeTab === 'members'}
				<label class="directory-filters__toggle">
					<input type="checkbox" class="checkbox checkbox-sm" bind:checked={lookingForBand} />
					<span>Looking for band</span>
				</label>
				<label class="directory-filters__toggle">
					<input type="checkbox" class="checkbox checkbox-sm" bind:checked={availableForHire} />
					<span>Available for hire</span>
				</label>
				<label class="directory-filters__toggle">
					<input type="checkbox" class="checkbox checkbox-sm" bind:checked={teachesLessons} />
					<span>Teaches lessons</span>
				</label>
			{:else}
				<label class="directory-filters__toggle">
					<input type="checkbox" class="checkbox checkbox-sm" bind:checked={lookingForMembers} />
					<span>Looking for members</span>
				</label>
			{/if}
		</div>
		<div class="directory-filters__tags">
			{#if activeTab === 'members'}
				<div class="directory-filters__tag-field">
					<p class="directory-filters__label">Instruments</p>
					<FreeformTagInput
						bind:value={filterInstruments}
						suggestions={instrumentSuggestions}
						placeholder="Filter by instrument..."
					/>
				</div>
			{/if}
			<div class="directory-filters__tag-field">
				<p class="directory-filters__label">Genres</p>
				<FreeformTagInput
					bind:value={filterGenres}
					suggestions={genreSuggestions}
					placeholder="Filter by genre..."
				/>
			</div>
		</div>
	</div>

	{#if activeTab === 'members'}
		{#if members.length === 0}
			<EmptyState message="No members match your filters." />
		{:else}
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center">
				{#each members as member (member.id)}
					<IdCard
						href="/member/directory/members/{member.id}"
						name={member.name}
						image={member.image}
						pronouns={member.pronouns}
						tagline={member.tagline}
						instruments={member.instruments}
						genres={member.genres}
						bands={member.bands}
						lookingForBand={member.lookingForBand}
						availableForHire={member.availableForHire}
						teachesLessons={member.teachesLessons}
						memberSince={new Date(member.createdAt).getFullYear()}
					/>
				{/each}
			</div>
		{/if}
	{/if}

	{#if activeTab === 'bands'}
		{#if bands.length === 0}
			<EmptyState message="No bands match your filters." />
		{:else}
			<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 justify-items-center">
				{#each bands as b, i (b.id)}
					<VinylCard
						href="/member/directory/bands/{b.slug}"
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
</PageContent>
