<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import { fullDate, formatTime, formatCents } from '$lib/utils/format';

	let { data }: { data: {
		event: {
			id: string;
			title: string;
			description: string | null;
			startsAt: string;
			endsAt: string;
			doorsAt: string | null;
			tags: string | null;
			posterUrl: string | null;
			ticketingEnabled: boolean;
			ticketPrice: number | null;
			ticketQuantity: number | null;
		};
		remaining: number | null;
		isSustainingMember: boolean;
	} } = $props();

	const evt = $derived(data.event);
	const soldOut = $derived(data.remaining === 0);

	function parseTags(tags: string | null): string[] {
		if (!tags) return [];
		return tags.split(',').map((t) => t.trim()).filter(Boolean);
	}

	const discountedPrice = $derived(
		evt.ticketPrice && data.isSustainingMember
			? Math.round(evt.ticketPrice / 2)
			: evt.ticketPrice
	);
</script>

<PageHeader title={evt.title} backHref="/member/events" />
<PageContent width="2xl">

	{#if evt.posterUrl}
		<figure class="rounded-lg overflow-hidden">
			<img src={evt.posterUrl} alt={evt.title} class="w-full max-h-64 object-cover" />
		</figure>
	{/if}

	<div class="card bg-base-100 shadow">
		<div class="card-body">
			<p class="opacity-70">
				{fullDate(evt.startsAt)}
				{#if evt.doorsAt}
					· Doors {formatTime(evt.doorsAt)}
				{/if}
				· {formatTime(evt.startsAt)} – {formatTime(evt.endsAt)}
			</p>

			{#if evt.description}
				<p class="mt-2 whitespace-pre-line">{evt.description}</p>
			{/if}

			{#if parseTags(evt.tags).length > 0}
				<div class="flex gap-1.5 flex-wrap mt-3">
					{#each parseTags(evt.tags) as tag (tag)}
						<span class="badge badge-outline">{tag}</span>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	{#if evt.ticketingEnabled && evt.ticketPrice}
		<div class="card bg-base-100 shadow">
			<div class="card-body">
				<h3 class="card-title text-base">Tickets</h3>
				<div class="flex items-baseline gap-2">
					{#if data.isSustainingMember && discountedPrice}
						<span class="text-lg font-bold">{formatCents(discountedPrice)}</span>
						<span class="text-sm line-through opacity-50">{formatCents(evt.ticketPrice)}</span>
						<span class="badge badge-success badge-sm">Member 50% off</span>
					{:else}
						<span class="text-lg font-bold">{formatCents(evt.ticketPrice)}</span>
					{/if}
				</div>
				{#if data.remaining !== null}
					<p class="text-sm mt-1">
						{#if soldOut}
							<span class="text-error font-medium">Sold out</span>
						{:else}
							{data.remaining} tickets remaining
						{/if}
					</p>
				{/if}
				{#if !soldOut}
					<div class="card-actions mt-3">
						<a href="/events/{evt.id}/tickets" class="btn btn-primary">Get Tickets</a>
					</div>
				{/if}
			</div>
		</div>
	{/if}

</PageContent>
