<script lang="ts">
	import PosterCard from '$lib/components/shared/PosterCard.svelte';
	import type { EventsResponse } from '$lib/server/db/schema/api';

	let { data }: { data: EventsResponse } = $props();
</script>

<svelte:head>
	<title>Events | Corvallis Music Collective</title>
	<meta name="description" content="Upcoming shows, jams, and meetups from the Corvallis Music Collective." />
</svelte:head>

{#if data.events.length === 0}
	<section class="py-16 px-6">
		<div class="max-w-4xl mx-auto text-center">
			<h1 class="text-4xl font-bold tracking-tight mb-4" style="color: var(--cmc-navy)">Upcoming Events</h1>
			<p class="text-lg" style="color: var(--fg-2)">No upcoming events right now. Check back soon!</p>
		</div>
	</section>
{:else}
	<section class="corkboard py-16 px-6">
		<div class="max-w-6xl mx-auto">
			<div class="text-center mb-10">
				<h1 class="text-4xl font-bold tracking-tight mb-2" style="color: var(--cmc-cream); text-shadow: 0 2px 8px rgba(0,0,0,0.25)">Upcoming Events</h1>
				<p class="text-base" style="color: var(--cmc-cream); opacity: 0.92; text-shadow: 0 1px 3px rgba(0,0,0,0.3)">Shows, jams, and meetups from the Collective</p>
			</div>

			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 justify-items-center">
				{#each data.events as evt (evt.id)}
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
