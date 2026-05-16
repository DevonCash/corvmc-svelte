<script lang="ts">
	import { formatCents } from '$lib/utils/format';
	import speakerLogo from '$lib/assets/cmc-speaker.png';
	import type { EventsResponse } from '$lib/types/api';

	let { data }: { data: EventsResponse } = $props();

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-US', {
			timeZone: 'America/Los_Angeles',
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
	}

	function formatTime(iso: string): string {
		return new Date(iso).toLocaleTimeString('en-US', {
			timeZone: 'America/Los_Angeles',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function parseTags(tags: string | null): string[] {
		if (!tags) return [];
		return tags.split(',').map((t) => t.trim()).filter(Boolean);
	}
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
					<a href="/events/{evt.id}" class="poster-card">
						<figure class="poster-card__figure">
							{#if evt.posterUrl}
								<img src={evt.posterUrl} alt={evt.title} />
							{:else}
								<div class="flex flex-col items-center justify-center gap-2 p-6 text-center" style="color: var(--cmc-navy)">
									<img src={speakerLogo} alt="" class="h-16 w-auto opacity-40" />
									<span class="text-sm font-bold opacity-50">{evt.title}</span>
								</div>
							{/if}
						</figure>
						<div class="poster-card__caption">
							<img class="poster-card__logo" src={speakerLogo} alt="" />
							<div class="poster-card__caption-text">
								<div class="poster-card__title">{evt.title}</div>
								<div class="poster-card__date">
									{formatDate(evt.startsAt)} · {formatTime(evt.startsAt)}
									{#if evt.ticketingEnabled && evt.ticketPrice}
										· {formatCents(evt.ticketPrice)}
									{/if}
								</div>
							</div>
						</div>
						{#if parseTags(evt.tags).length > 0}
							<div class="flex gap-1.5 flex-wrap px-3 pb-3" style="background: var(--cmc-parchment)">
								{#each parseTags(evt.tags) as tag (tag)}
									<span class="sticker-badge sticker-badge--sm">{tag}</span>
								{/each}
							</div>
						{/if}
					</a>
				{/each}
			</div>
		</div>
	</section>
{/if}
