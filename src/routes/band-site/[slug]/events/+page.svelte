<script lang="ts">
	import { getBandSiteData } from '$lib/remote/band-site.remote';
	import { resolve } from '$app/paths';
	import { formatDate, formatTime } from '$lib/utils/format';
	import { page } from '$app/state';

	let data = $derived(await getBandSiteData(page.params.slug!));
	const events = $derived(data.events);
</script>

<svelte:head>
	<title>Events — {data.band.name}</title>
</svelte:head>

<div class="max-w-3xl mx-auto px-6 py-12">
	<a
		href={`/${page.params.slug ? `?__band_subdomain=${page.params.slug}` : ''}`}
		class="link text-sm opacity-60 mb-6 block"
	>
		&larr; Back to {data.band.name}
	</a>

	<h1 class="text-3xl font-bold mb-8">All Events</h1>

	{#if events.length === 0}
		<p class="text-center opacity-60 py-12">No upcoming events.</p>
	{:else}
		<div class="space-y-4">
			{#each events as evt (evt.id)}
				<div
					class="flex items-start justify-between p-5 rounded-lg"
					style="background-color: var(--bs-surface, oklch(var(--b2)));"
				>
					<div>
						{#if evt.posterUrl}
							<img
								src={evt.posterUrl}
								alt=""
								class="w-16 h-16 rounded-lg object-cover float-left mr-4"
							/>
						{/if}
						<h2 class="text-lg font-semibold">{evt.title}</h2>
						<p class="text-sm opacity-70 mt-1">
							{formatDate(evt.startsAt)} &middot; {formatTime(evt.startsAt)}
						</p>
						{#if evt.location}
							<p class="text-sm opacity-60">{evt.location}</p>
						{/if}
						{#if evt.description}
							<p class="text-sm mt-2 opacity-80">{evt.description}</p>
						{/if}
					</div>
					{#if evt.externalTicketUrl}
						<a
							href={evt.externalTicketUrl}
							target="_blank"
							rel="noopener external"
							class="btn btn-primary btn-sm shrink-0 ml-4"
						>
							Tickets
						</a>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Minimal footer -->
<footer class="text-center py-6 text-xs opacity-40">
	<a href={resolve('/')} class="hover:opacity-70">Corvallis Music Collective</a>
</footer>
