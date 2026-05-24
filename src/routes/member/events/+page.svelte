<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import PosterCard from '$lib/components/shared/events/PosterCard.svelte';
	import TicketStub from '$lib/components/shared/events/TicketStub.svelte';
	import SectionLabel from '$lib/components/shared/SectionLabel.svelte';
	import Carousel from '$lib/components/shared/Carousel.svelte';
	import ButtonGroup from '$lib/components/shared/ButtonGroup.svelte';
	import { tagToTapeVariant } from '$lib/utils/tag-colors';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const activeTickets = $derived(
		data.tickets.filter(
			(t) => t.event && new Date(t.event.startsAt) > new Date() && t.status !== 'cancelled'
		)
	);

	const ticketedEventIds = $derived(new Set(activeTickets.map((t) => t.eventId)));

	const eventTagMap = $derived(
		new Map(data.events.map((e) => [e.id, e.tags]))
	);

	const allTags = $derived.by(() => {
		const tags = new Set<string>();
		for (const evt of data.events) {
			if (evt.tags) {
				for (const t of evt.tags.split(',')) {
					const trimmed = t.trim();
					if (trimmed) tags.add(trimmed);
				}
			}
		}
		return [...tags];
	});

	let activeFilter = $state<string | null>(null);

	const filteredEvents = $derived(
		activeFilter
			? data.events.filter((e) => {
					if (!e.tags) return false;
					return e.tags.split(',').some((t) => t.trim() === activeFilter);
				})
			: data.events
	);

	function primaryTag(tags: string | null | undefined): string | undefined {
		if (!tags) return undefined;
		return tags.split(',')[0]?.trim() || undefined;
	}
</script>

<PageHeader title="Events" />
<PageContent>

	{#if activeTickets.length > 0}
		<section>
			<SectionLabel label="My Tickets" count={activeTickets.length} />
			<Carousel itemCount={activeTickets.length} cardWidth={360}>
				{#each activeTickets as ticket (ticket.id)}
					<TicketStub {ticket} tags={eventTagMap.get(ticket.eventId) ?? null} />
				{/each}
			</Carousel>
		</section>
	{/if}

	<section>
		<SectionLabel label="Upcoming" count={filteredEvents.length} />

		{#if allTags.length > 1}
			<div class="mb-4">
				<ButtonGroup wrap>
					<button
						class="btn btn-sm"
						class:btn-primary={activeFilter === null}
						onclick={() => (activeFilter = null)}
					>
						All <span class="opacity-60 ml-1">{data.events.length}</span>
					</button>
					{#each allTags as tag (tag)}
						<button
							class="btn btn-sm"
							class:btn-primary={activeFilter === tag}
							onclick={() => (activeFilter = activeFilter === tag ? null : tag)}
						>
							{tag}
							<span class="opacity-60 ml-1">
								{data.events.filter((e) => e.tags?.split(',').some((t) => t.trim() === tag)).length}
							</span>
						</button>
					{/each}
				</ButtonGroup>
			</div>
		{/if}

		{#if filteredEvents.length === 0}
			<div class="text-center py-8 opacity-60">
				<p class="text-base">No upcoming events right now. Check back soon!</p>
			</div>
		{:else}
			<div class="pgrid">
				{#each filteredEvents as evt (evt.id)}
					<PosterCard
						href="/member/events/{evt.id}"
						title={evt.title}
						posterUrl={evt.posterUrl}
						startsAt={evt.startsAt}
						ticketingEnabled={evt.ticketingEnabled}
						ticketPrice={evt.ticketPrice}
						tags={evt.tags}
						tapeLabel={primaryTag(evt.tags)}
						tapeColor={primaryTag(evt.tags) ? tagToTapeVariant(primaryTag(evt.tags)!) : ''}
						hasTicket={ticketedEventIds.has(evt.id)}
						class="w-full"
					/>
				{/each}
			</div>
		{/if}
	</section>

</PageContent>
