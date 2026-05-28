<script lang="ts">
	import PosterCard from '$lib/components/shared/events/PosterCard.svelte';
	import { getPublicEvents } from '$lib/remote/events.remote';

	let { upcoming, past } = $derived(await getPublicEvents());
</script>

<svelte:head>
	<title>Events | Corvallis Music Collective</title>
	<meta name="description" content="Upcoming shows, jams, and meetups from the Corvallis Music Collective." />
	<meta property="og:title" content="Events | Corvallis Music Collective" />
	<meta property="og:description" content="Upcoming shows, jams, and meetups from the Corvallis Music Collective." />
</svelte:head>

<section class="py-16 px-6">
	<div class="max-w-5xl mx-auto">
		<div class="text-center mb-10">
			<h1 class="text-4xl font-bold tracking-tight mb-2" style="color: var(--cmc-navy)">Events</h1>
			<p class="text-base" style="color: var(--fg-2)">Shows, jams, and meetups from the Collective</p>
		</div>

		{#if upcoming.length > 0}
			<h2 class="text-xl font-semibold mb-4" style="color: var(--cmc-navy)">Upcoming</h2>
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
				{#each upcoming as evt (evt.id)}
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
		{:else}
			<div class="text-center py-8 mb-8 opacity-60">
				<p class="text-base">No upcoming events right now. Check back soon!</p>
			</div>
		{/if}

		{#if past.length > 0}
			<h2 class="text-xl font-semibold mb-4" style="color: var(--fg-2)">Past Events</h2>
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 opacity-75">
				{#each past as evt (evt.id)}
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
		{/if}
	</div>
</section>
