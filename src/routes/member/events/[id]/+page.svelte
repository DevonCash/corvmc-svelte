<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import Action from '$lib/components/shared/Action.svelte';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import { Field } from '$lib/components/shared/Form';
	import Badge from '$lib/components/shared/Badge.svelte';
	import { fullDate, formatTime, formatCents } from '$lib/utils/format';
	import { purchaseTickets } from '$lib/remote/events';

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

	const subtotal = $derived((discountedPrice ?? 0) * quantity);

	function parseTags(tags: string | null): string[] {
		if (!tags) return [];
		return tags.split(',').map((t) => t.trim()).filter(Boolean);
	}

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
						<Badge variant="success">Member 50% off</Badge>
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
						<Action
							action={purchaseTickets}
							label="Get Tickets"
							modalTitle="Get Tickets"
							submitLabel="Purchase {quantity === 1 ? 'Ticket' : `${quantity} Tickets`}"
							canSubmit={!!attendeeName.trim() && !!attendeeEmail.trim()}
							class="btn-primary"
							onsuccess={handlePurchaseSuccess}
							onfailure={(err) => toast.error(err instanceof Error ? err.message : 'Something went wrong')}
						>
							{#snippet form({ close })}
								<input type="hidden" name="eventId" value={evt.id} />

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
					</div>
				{/if}
			</div>
		</div>
	{/if}

</PageContent>
