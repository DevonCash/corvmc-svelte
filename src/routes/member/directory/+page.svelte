<script lang="ts">
	import { getMembers, getBands, getInstrumentSuggestions, getGenreSuggestions } from './data.remote';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import TabBar from '$lib/components/shared/TabBar.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import FreeformTagInput from '$lib/components/shared/FreeformTagInput.svelte';
	import speakerLogo from '$lib/assets/cmc-speaker-icon.svg';
	import logoMono from '$lib/assets/cmc-logo-mono.svg';

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

	const bandColors = ['#e5771e', '#003b5c', '#00859b', '#f84d13', '#ffb500', '#5a3d2b'];

	function initials(name: string): string {
		return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
	}
</script>

<PageHeader title="Directory" subtitle="Community" />
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
			<EmptyState message="No members match your filters." />
		{:else}
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center">
				{#each members as member (member.id)}
					<a href="/member/directory/members/{member.id}" class="id-card">
						<div class="id-card__header">
							<div class="id-card__brand">
								<img src={speakerLogo} alt="" class="id-card__logo" />
								<span>Corvallis Music<br/>Collective</span>
							</div>
							<div class="id-card__tag">MEMBER</div>
						</div>
						<div class="id-card__body">
							<div class="id-card__photo">
								{#if member.image}
									<img src={member.image} alt={member.name} class="w-full h-full object-cover rounded" />
								{:else}
									{initials(member.name)}
								{/if}
							</div>
							<div class="id-card__info">
								<div class="id-card__name">
									{member.name}
									{#if member.pronouns}
										<span class="id-card__pronouns">{member.pronouns}</span>
									{/if}
								</div>
								{#if member.tagline}
									<div class="id-card__role">{member.tagline}</div>
								{/if}
								{#if member.instruments?.length || member.genres?.length}
									<div class="id-card__badges">
										{#each member.instruments ?? [] as inst}
											<span class="id-tag id-tag--teal">{inst}</span>
										{/each}
										{#each member.genres ?? [] as genre}
											<span class="id-tag">{genre}</span>
										{/each}
									</div>
								{/if}
								{#if member.bands?.length}
									<div class="id-card__bands">
										{#each member.bands as b}
											<span class="id-tag id-tag--band">{b.name}</span>
										{/each}
									</div>
								{/if}
							</div>
						</div>
						{#if member.lookingForBand}
							<div class="id-card__gaff bg-primary text-primary-contrast">seeking a band</div>
						{/if}
						<div class="id-card__footer">
							<div class="id-card__since">Member since {new Date(member.createdAt).getFullYear()}</div>
							<div class="id-card__barcode" aria-hidden="true"></div>
						</div>
					</a>
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
					<a href="/member/directory/bands/{b.slug}" class="vinyl-card" style="--vinyl-label: {bandColors[i % bandColors.length]}">
						<div class="vinyl-card__sleeve-wrap">
							<div class="vinyl-card__disc">
								<div class="vinyl-card__label">
									<svg class="vinyl-card__arc" viewBox="0 0 100 100">
										<defs>
											<path id="arc-top-{b.id}" d="M 15,50 a 35,35 0 1,1 70,0" fill="none" />
											<path id="arc-bot-{b.id}" d="M 85,50 a 35,35 0 1,1 -70,0" fill="none" />
										</defs>
										<text>
											<textPath href="#arc-top-{b.id}" startOffset="50%" text-anchor="middle">{b.name}</textPath>
										</text>
										<text>
											<textPath href="#arc-bot-{b.id}" startOffset="50%" text-anchor="middle">Corvallis Music Collective</textPath>
										</text>
									</svg>
									<img class="vinyl-card__logo" src={logoMono} alt="" />
								</div>
							</div>
							<div class="vinyl-card__sleeve">
								<div class="vinyl-card__sleeve-art">
									{#if b.avatarUrl}
										<img src={b.avatarUrl} alt={b.name} class="w-full h-full object-cover" />
									{:else}
										{initials(b.name)}
									{/if}
								</div>
							</div>
							{#if b.lookingForMembers}
								<div class="vinyl-card__gaff">seeking members</div>
							{/if}
						</div>
						<div class="vinyl-card__caption">
							<div class="vinyl-card__band">{b.name}</div>
							<div class="vinyl-card__meta">
								{#if b.tagline}
									{b.tagline}
								{:else}
									{b.memberCount} member{b.memberCount === 1 ? '' : 's'}
								{/if}
							</div>
						</div>
					</a>
				{/each}
			</div>
		{/if}
	{/if}
</PageContent>
