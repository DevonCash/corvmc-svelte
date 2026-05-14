<script lang="ts">
	import type { PageServerData } from './$types';
	import { formatCents } from '$lib/utils/format';

	let { data }: { data: PageServerData } = $props();

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-US', {
			timeZone: 'America/Los_Angeles',
			weekday: 'long',
			month: 'long',
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

	function truncate(text: string, maxLen: number): string {
		if (text.length <= maxLen) return text;
		return text.slice(0, maxLen).trimEnd() + '…';
	}
</script>

<div class="max-w-4xl mx-auto px-4 py-8 space-y-8">
	<h1 class="text-3xl font-bold">Upcoming Events</h1>

	{#if data.events.length === 0}
		<p class="text-lg opacity-60">No upcoming events right now. Check back soon!</p>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
			{#each data.events as evt (evt.id)}
				<div class="card bg-base-100 shadow">
					{#if evt.posterUrl}
						<figure>
							<img src={evt.posterUrl} alt={evt.title} class="w-full h-48 object-cover" />
						</figure>
					{/if}
					<div class="card-body">
						<h2 class="card-title">{evt.title}</h2>

						<p class="text-sm opacity-70">
							{formatDate(evt.startsAt)}
						</p>
						<p class="text-sm opacity-70">
							{#if evt.doorsAt}
								Doors {formatTime(evt.doorsAt)} · Show {formatTime(evt.startsAt)}
							{:else}
								{formatTime(evt.startsAt)} – {formatTime(evt.endsAt)}
							{/if}
						</p>

						{#if evt.description}
							<p class="mt-2 opacity-80">{truncate(evt.description, 200)}</p>
						{/if}

						{#if parseTags(evt.tags).length > 0}
							<div class="mt-2 flex gap-1 flex-wrap">
								{#each parseTags(evt.tags) as tag (tag)}
									<span class="badge badge-outline badge-sm">{tag}</span>
								{/each}
							</div>
						{/if}

						{#if evt.ticketingEnabled && evt.ticketPrice}
							<div class="card-actions justify-between items-center mt-4">
								<span class="font-medium">{formatCents(evt.ticketPrice)}</span>
								<a href="/events/{evt.id}/tickets" class="btn btn-primary btn-sm">Get Tickets</a>
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
