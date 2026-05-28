<script lang="ts">
	import PosterCard from '$lib/components/shared/events/PosterCard.svelte';
	import { getPublicEvents } from '$lib/remote/events.remote';

	let events = $derived(await getPublicEvents());
</script>

<svelte:head>
	<title>Events | Corvallis Music Collective</title>
	<meta name="description" content="Upcoming shows, jams, and meetups from the Corvallis Music Collective." />
	<meta property="og:title" content="Events | Corvallis Music Collective" />
	<meta property="og:description" content="Upcoming shows, jams, and meetups from the Corvallis Music Collective." />
</svelte:head>

{#if events.length === 0}
	<section class="py-16 px-6">
		<div class="max-w-4xl mx-auto text-center">
			<h1 class="text-4xl font-bold tracking-tight mb-4" style="color: var(--cmc-navy)">Upcoming Events</h1>
			<p class="text-lg" style="color: var(--fg-2)">No upcoming events right now. Check back soon!</p>
		</div>
	</section>
{:else}
	<section class="py-16 px-6">
		<div class="max-w-5xl mx-auto">
			<div class="text-center mb-10">
				<h1 class="text-4xl font-bold tracking-tight mb-2" style="color: var(--cmc-navy)">Upcoming Events</h1>
				<p class="text-base" style="color: var(--fg-2)">Shows, jams, and meetups from the Collective</p>
			</div>

			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
				{#each events as evt (evt.id)}
					<PosterCard
						href="/events/{evt.id}"
						title={evt.title}
						posterUrl={evt.posterUrl}
						startsAt={evt.startsAt}
						ticketingEnabled={evt.ticketingEnabled}
						ticketPrice={evt.ticketPrice}
						tags={evt.tags}
					/>
				{/each}
			</div>
		</div>
	</section>
{/if}
