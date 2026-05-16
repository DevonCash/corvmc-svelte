<script lang="ts">
	import TabBar from '$lib/components/shared/TabBar.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import speakerLogo from '$lib/assets/cmc-speaker.png';
	import type { DirectoryResponse } from '$lib/types/api';

	let { data }: { data: DirectoryResponse } = $props();

	const members = $derived(data.members);
	const bands = $derived(data.bands);

	let activeTab = $state<'members' | 'bands'>('members');

	const bandColors = ['#e5771e', '#003b5c', '#00859b', '#f84d13', '#ffb500', '#5a3d2b'];

	function initials(name: string): string {
		return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
	}
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
						<a href="/directory/members/{member.id}" class="id-card">
							<div class="id-card__hole"></div>
							<div class="id-card__header">
								<div class="id-card__brand">Corvallis Music Collective</div>
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
									<div class="id-card__name">{member.name}</div>
									{#if member.tagline}
										<div class="id-card__role">{member.tagline}</div>
									{/if}
									{#if member.instruments?.length || member.genres?.length}
										<div class="id-card__badges">
											{#each (member.instruments ?? []).slice(0, 2) as inst}
												<span class="sticker-badge sticker-badge--sm sticker-badge--teal">{inst}</span>
											{/each}
											{#each (member.genres ?? []).slice(0, 2) as genre}
												<span class="sticker-badge sticker-badge--sm">{genre}</span>
											{/each}
										</div>
									{/if}
								</div>
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
				<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 justify-items-center">
					{#each bands as b, i (b.id)}
						<a href="/directory/bands/{b.slug}" class="vinyl-card" style="--vinyl-label: {bandColors[i % bandColors.length]}">
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
										<img class="vinyl-card__logo" src={speakerLogo} alt="" />
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
	</div>
</section>
