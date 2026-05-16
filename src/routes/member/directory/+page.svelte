<script lang="ts">
	import { getMembers, getBands, getInstrumentSuggestions, getGenreSuggestions } from './data.remote';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import TabBar from '$lib/components/shared/TabBar.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import FreeformTagInput from '$lib/components/shared/FreeformTagInput.svelte';
	import type { ProfileLink } from '$lib/types/profile';

	let activeTab = $state<'members' | 'bands'>('members');
	let search = $state('');
	let filterInstruments = $state<string[]>([]);
	let filterGenres = $state<string[]>([]);
	let lookingForBand = $state(false);
	let lookingForMembers = $state(false);

	let filters = $derived({
		search: search || undefined,
		instruments: filterInstruments.length > 0 ? JSON.stringify(filterInstruments) : undefined,
		genres: filterGenres.length > 0 ? JSON.stringify(filterGenres) : undefined,
		lookingForBand: lookingForBand ? 'true' : undefined,
		lookingForMembers: lookingForMembers ? 'true' : undefined
	});

	let members = $derived(await getMembers(filters));
	let bands = $derived(await getBands(filters));
	let instrumentSuggestions = $derived(await getInstrumentSuggestions());
	let genreSuggestions = $derived(await getGenreSuggestions());
</script>

	<PageHeader title="Directory" subtitle="Community" />

	<div class="space-y-4">
		<!-- Search & Filters -->
		<div class="flex flex-wrap gap-3 items-end">
			<input
				type="text"
				placeholder="Search by name..."
				class="input input-bordered w-full max-w-xs"
				bind:value={search}
			/>
			{#if activeTab === 'members'}
				<label class="label cursor-pointer gap-2">
					<input type="checkbox" class="checkbox checkbox-sm" bind:checked={lookingForBand} />
					<span class="text-sm">Looking for band</span>
				</label>
			{:else}
				<label class="label cursor-pointer gap-2">
					<input type="checkbox" class="checkbox checkbox-sm" bind:checked={lookingForMembers} />
					<span class="text-sm">Looking for members</span>
				</label>
			{/if}
		</div>

		<div class="grid gap-3 sm:grid-cols-2 max-w-xl">
			{#if activeTab === 'members'}
				<div>
					<p class="text-xs font-medium mb-1 opacity-60">Instruments</p>
					<FreeformTagInput
						bind:value={filterInstruments}
						suggestions={instrumentSuggestions}
						placeholder="Filter by instrument..."
					/>
				</div>
			{/if}
			<div>
				<p class="text-xs font-medium mb-1 opacity-60">Genres</p>
				<FreeformTagInput
					bind:value={filterGenres}
					suggestions={genreSuggestions}
					placeholder="Filter by genre..."
				/>
			</div>
		</div>

		<TabBar
			tabs={[
				{ key: 'members', label: `Members (${members.length})` },
				{ key: 'bands', label: `Bands (${bands.length})` }
			]}
			active={activeTab}
			onchange={(key) => (activeTab = key as 'members' | 'bands')}
		/>

		<!-- Members Grid -->
		{#if activeTab === 'members'}
			{#if members.length === 0}
				<EmptyState message="No members match your filters." />
			{:else}
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{#each members as member (member.id)}
						<a
							href="/member/directory/members/{member.id}"
							class="card bg-base-100 shadow-sm transition-shadow hover:shadow-md"
						>
							<div class="card-body py-4">
								<div class="flex items-center gap-3">
									<div class="avatar placeholder">
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
										{#if (member.instruments?.length ?? 0) > 3}
											<span class="badge badge-ghost badge-xs">+{(member.instruments?.length ?? 0) - 3}</span>
										{/if}
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

		<!-- Bands Grid -->
		{#if activeTab === 'bands'}
			{#if bands.length === 0}
				<EmptyState message="No bands match your filters." />
			{:else}
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{#each bands as b (b.id)}
						<a
							href="/member/directory/bands/{b.slug}"
							class="card bg-base-100 shadow-sm transition-shadow hover:shadow-md"
						>
							<div class="card-body py-4">
								<div class="flex items-center gap-3">
									<div class="avatar placeholder">
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
										{#each (b.genres ?? []).slice(0, 4) as genre}
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
	</div>


