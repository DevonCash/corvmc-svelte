<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import DateBlockCard from '$lib/components/shared/DateBlockCard.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import { formatDate, formatTime, formatTimeRange, formatCents } from '$lib/utils/format';
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
			<div class="grid grid-cols-1 gap-3 max-w-2xl">
				{#each activeTickets as ticket (ticket.id)}
					{#if ticket.event}
						<DateBlockCard date={ticket.event.startsAt}>
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
			<EmptyState
				title="No upcoming events"
				description="Check back soon for shows, jams, and meetups."
			/>
		{:else}
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each data.events as evt (evt.id)}
					<a href="/member/events/{evt.id}" class="card bg-base-100 shadow transition-shadow hover:shadow-md">
						{#if evt.posterUrl}
							<figure>
								<img src={evt.posterUrl} alt={evt.title} class="h-40 w-full object-cover" />
							</figure>
						{/if}
						<div class="card-body p-4">
							<p class="font-medium">{evt.title}</p>
							<p class="text-sm opacity-60">
								{formatDate(evt.startsAt)} · {formatTime(evt.startsAt)}
							</p>
							{#if evt.ticketingEnabled && evt.ticketPrice}
								<div class="mt-1">
									<span class="badge badge-primary badge-sm">{formatCents(evt.ticketPrice)}</span>
								</div>
							{/if}
							{#if parseTags(evt.tags).length > 0}
								<div class="flex gap-1.5 flex-wrap mt-2">
									{#each parseTags(evt.tags) as tag (tag)}
										<span class="badge badge-outline badge-sm">{tag}</span>
									{/each}
								</div>
							{/if}
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</section>

</PageContent>
