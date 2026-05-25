<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import Action from '$lib/components/shared/Action.svelte';
	import { Field } from '$lib/components/shared/Form';
	import Badge from '$lib/components/shared/Badge.svelte';
	import PosterCard from '$lib/components/shared/events/PosterCard.svelte';
	import TicketQRModal from '$lib/components/shared/events/TicketQRModal.svelte';
	import { fullDate, formatTime, formatCents, formatDate } from '$lib/utils/format';
	import { tagToTapeVariant, tagToStickerColor } from '$lib/utils/tag-colors';
	import { purchaseTickets, getMemberEventDetail, getMemberTickets } from '$lib/remote/events.remote';

	const { fields } = purchaseTickets;

	let eventData = $derived(await getMemberEventDetail(page.params.id!));
	let allTickets = $derived(await getMemberTickets());
	let myTickets = $derived(allTickets.filter((t) => t.eventId === page.params.id && t.status !== 'cancelled'));
	let myTicket = $derived(myTickets[0] ?? null);
	let data = $derived({ ...eventData, myTicket });

	const evt = $derived(data.event);
	const soldOut = $derived(data.remaining === 0);
	const maxQuantity = $derived(
		data.remaining !== null ? Math.min(data.remaining, 10) : 10
	);

	const discountedPrice = $derived(
		evt.ticketPrice && data.isSustainingMember
			? Math.round(evt.ticketPrice / 2)
			: evt.ticketPrice
	);

	let quantity = $state(1);
	let attendeeName = $state((page.data as any).user?.name ?? '');
	let attendeeEmail = $state((page.data as any).user?.email ?? '');
	let coverFees = $state(false);
	let qrOpen = $state(false);

	const subtotal = $derived((discountedPrice ?? 0) * quantity);

	function parseTags(tags: string | null): string[] {
		if (!tags) return [];
		return tags.split(',').map((t) => t.trim()).filter(Boolean);
	}

	const tagList = $derived(parseTags(evt.tags));
	const primaryTag = $derived(tagList[0] ?? null);

	async function handlePurchaseSuccess(result?: unknown) {
		const data = result as { redirectUrl?: string } | undefined;
		if (data?.redirectUrl) {
			if (data.redirectUrl.startsWith('http')) {
				window.location.href = data.redirectUrl;
			} else {
				await goto(data.redirectUrl);
			}
		}
	}
</script>

<PageHeader title={evt.title} backHref="/member/events" />
<PageContent>

	{#if data.myTicket}
		<button type="button" class="tixbanner" onclick={() => (qrOpen = true)}>
			<div class="tixbanner__icon">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><path d="M5 12l4 4 10-10"/></svg>
			</div>
			<div class="tixbanner__text">
				<strong>You're going!</strong>
				<small>{myTickets.length === 1 ? data.myTicket.code : `${myTickets.length} tickets`}</small>
			</div>
			<span class="tixbanner__action">
				View ticket
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M9 6l6 6-6 6"/></svg>
			</span>
		</button>
		<TicketQRModal bind:open={qrOpen} tickets={myTickets} />
	{/if}

	<div class="edet">
		<div class="edet__poster">
			<PosterCard
				href="/member/events/{evt.id}"
				title={evt.title}
				posterUrl={evt.posterUrl}
				startsAt={evt.startsAt}
				ticketingEnabled={evt.ticketingEnabled}
				ticketPrice={evt.ticketPrice}
				tags={evt.tags}
				tapeLabel={primaryTag ?? undefined}
				tapeColor={primaryTag ? tagToTapeVariant(primaryTag) : ''}
				isStatic
				class="w-full"
			/>
		</div>

		<div class="edet__main">
			{#if tagList.length > 0}
				<div class="edet__tags">
					{#each tagList as tag (tag)}
						<span class="sticker {tagToStickerColor(tag)}">{tag}</span>
					{/each}
				</div>
			{/if}

			<h1 class="edet__title">{evt.title}</h1>

			<div class="edet__facts">
				<div class="edet__fact">
					<span class="edet__fact-label">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>
						Date
					</span>
					<span class="edet__fact-value">{fullDate(evt.startsAt)}</span>
				</div>
				<div class="edet__fact">
					<span class="edet__fact-label">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
						Time
					</span>
					<span class="edet__fact-value">
						{formatTime(evt.startsAt)} – {formatTime(evt.endsAt)}
						{#if evt.doorsAt}
							<br /><span style="font-size:12px;opacity:0.7">Doors {formatTime(evt.doorsAt)}</span>
						{/if}
					</span>
				</div>
				<div class="edet__fact">
					<span class="edet__fact-label">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z"/><path d="M13 6v12"/></svg>
						Price
					</span>
					<span class="edet__fact-value">
						{#if !evt.ticketingEnabled}
							Free
						{:else if evt.ticketPrice}
							{#if data.isSustainingMember && discountedPrice}
								{formatCents(discountedPrice)}
								<span style="font-size:11px;opacity:0.5;text-decoration:line-through;margin-left:4px">{formatCents(evt.ticketPrice)}</span>
							{:else}
								{formatCents(evt.ticketPrice)}
							{/if}
						{:else}
							Free
						{/if}
					</span>
				</div>
			</div>

			{#if evt.description}
				<p class="edet__desc">{evt.description}</p>
			{/if}

			{#if evt.ticketingEnabled && evt.ticketPrice}
				<div class="edet__ctas">
					{#if soldOut}
						<button class="btn btn-lg" disabled>Sold Out</button>
					{:else if !data.myTicket}
						<Action
							action={purchaseTickets}
							label="Get Tickets"
							modalTitle="Get Tickets"
							submitLabel="Purchase {quantity === 1 ? 'Ticket' : `${quantity} Tickets`}"
							canSubmit={!!attendeeName.trim() && !!attendeeEmail.trim()}
							class="btn-primary btn-lg"
							onsuccess={handlePurchaseSuccess}
							onfailure={(err) => toast.error(err instanceof Error ? err.message : 'Something went wrong')}
						>
							{#snippet form({ close })}
								<input {...fields.eventId.as('hidden', evt.id)} />

								<div class="flex items-baseline gap-2">
									{#if data.isSustainingMember && discountedPrice}
										<span class="text-lg font-bold">{formatCents(discountedPrice)}</span>
										<span class="text-sm line-through opacity-50">{formatCents(evt.ticketPrice!)}</span>
										<Badge variant="success">Member 50% off</Badge>
									{:else}
										<span class="text-lg font-bold">{formatCents(evt.ticketPrice!)}</span>
									{/if}
									<span class="text-sm opacity-50">per ticket</span>
								</div>

								<Field label="Number of tickets" name="quantity">
									<select
										name="quantity"
										bind:value={quantity}
										class="select select-bordered w-full"
									>
										{#each Array.from({ length: maxQuantity }, (_, i) => i + 1) as n (n)}
											<option value={n}>{n}</option>
										{/each}
									</select>
								</Field>

								<Field name="attendeeName" type="text" label="Name" bind:value={attendeeName} />
								<Field name="attendeeEmail" type="email" label="Email" bind:value={attendeeEmail} />
								<Field name="coverFees" type="checkbox" bind:value={coverFees}
									checkboxLabel="Cover processing fees so the collective receives the full amount" />

								<div class="border-t border-base-200 pt-4">
									<div class="flex justify-between text-lg font-medium">
										<span>Total</span>
										<span>{formatCents(subtotal)}</span>
									</div>
									{#if data.isSustainingMember}
										<p class="text-sm text-success mt-1">Sustaining member discount applied</p>
									{/if}
								</div>
							{/snippet}
						</Action>
					{/if}

					{#if data.remaining !== null && !soldOut}
						<span class="text-sm" style="color: var(--fg-2)">{data.remaining} remaining</span>
					{/if}
				</div>
			{/if}
		</div>
	</div>

</PageContent>
