<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import DateBlockCard from '$lib/components/shared/DateBlockCard.svelte';
	import Logo from '$lib/components/shared/Logo.svelte';
	import { formatDate, formatTime, formatCents } from '$lib/utils/format';
	import type { EventsResponse, MemberTicketsResponse } from '$lib/server/db/schema/api';

	let { data }: { data: { events: EventsResponse['events']; tickets: MemberTicketsResponse['tickets'] } } = $props();

	const activeTickets = $derived(
		data.tickets.filter(
			(t) => t.event && new Date(t.event.startsAt) > new Date() && t.status !== 'cancelled'
		)
	);

	function parseTags(tags: string | null): string[] {
		if (!tags) return [];
		return tags.split(',').map((t) => t.trim()).filter(Boolean);
	}
</script>

<PageHeader title="Events" />
<PageContent>

	{#if activeTickets.length > 0}
		<section>
			<div class="flex items-center justify-between mb-3">
				<h3 class="text-sm font-medium opacity-60 uppercase tracking-wide">My Tickets</h3>
			</div>
			<div class="flex overflow-x-auto gap-3 pb-2">
				{#each activeTickets as ticket (ticket.id)}
					{#if ticket.event}
						<DateBlockCard date={ticket.event.startsAt} class="shrink-0 w-80">
							<div class="flex items-center justify-between gap-2">
								<span class="font-semibold text-sm">{ticket.event.title}</span>
								<StatusBadge status={ticket.status} />
							</div>
							<p class="text-sm opacity-60">
								{formatDate(ticket.event.startsAt)} · {formatTime(ticket.event.startsAt)}
							</p>
							<span class="font-mono text-xs opacity-40">{ticket.code}</span>
						</DateBlockCard>
					{/if}
				{/each}
			</div>
		</section>
	{/if}

	<section>
		<h3 class="text-sm font-medium opacity-60 uppercase tracking-wide mb-3">Upcoming Events</h3>

		{#if data.events.length === 0}
			<div class="text-center py-8 opacity-60">
				<p class="text-base">No upcoming events right now. Check back soon!</p>
			</div>
		{:else}
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 justify-items-center">
				{#each data.events as evt (evt.id)}
					<a href="/member/events/{evt.id}" class="poster-card w-full">
						<figure class="poster-card__figure">
							{#if evt.posterUrl}
								<img src={evt.posterUrl} alt={evt.title} />
							{:else}
								<div class="flex flex-col items-center justify-center gap-2 p-6 text-center" style="color: var(--cmc-navy)">
									<Logo soundLines={false} class="h-16 w-auto opacity-40" />
									<span class="text-sm font-bold opacity-50">{evt.title}</span>
								</div>
							{/if}
						</figure>
						<div class="poster-card__caption">
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
							<div class="absolute right-0 top-4 flex flex-col gap-1.5 items-end">
								{#each parseTags(evt.tags) as tag (tag)}
									<span class="sticker-badge sticker-badge--sm">{tag}</span>
								{/each}
							</div>
						{/if}
					</a>
				{/each}
			</div>
		{/if}
	</section>

</PageContent>
