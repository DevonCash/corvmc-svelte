<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import Alert from '$lib/components/shared/Alert.svelte';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import { Field } from '$lib/components/shared/Form';
	import { formatCents, fullDate, formatTime } from '$lib/utils/format';
	import { purchaseTickets } from './data.remote';

	let { data }: { data: any } = $props();

	let quantity = $state(1);
	let attendeeName = $state('');
	let attendeeEmail = $state('');
	let coverFees = $state(false);
	let submitting = $state(false);
	let errorMsg = $state('');

	const evt = $derived(data!.event);
	const unitPrice = $derived(evt.ticketPrice);
	const discountedPrice = $derived(
		data.isSustainingMember ? Math.round(unitPrice / 2) : unitPrice
	);
	const subtotal = $derived(discountedPrice * quantity);
	const soldOut = $derived(data.remaining === 0);
	const maxQuantity = $derived(
		data.remaining !== null ? Math.min(data.remaining, 10) : 10
	);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!attendeeName || !attendeeEmail) return;
		submitting = true;
		errorMsg = '';

		try {
			const result = await purchaseTickets({
				eventId: page.params.id!,
				quantity,
				attendeeName: attendeeName.trim(),
				attendeeEmail: attendeeEmail.trim(),
				coverFees
			});

			if (result?.redirectUrl) {
				if (result.redirectUrl.startsWith('http')) {
					window.location.href = result.redirectUrl;
				} else {
					await goto(result.redirectUrl);
				}
			}
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'Something went wrong';
			toast.error(errorMsg);
		} finally {
			submitting = false;
		}
	}
</script>

<div class="max-w-lg mx-auto space-y-6">
	<PageHeader title="Get Tickets" backHref="/events" />

	<div class="card bg-base-100 shadow">
		<div class="card-body">
			<h2 class="card-title">{evt.title}</h2>
			<p class="opacity-70">
				{fullDate(evt.startsAt)}
				{#if evt.doorsAt}
					· Doors {formatTime(evt.doorsAt)}
				{/if}
				· {formatTime(evt.startsAt)} – {formatTime(evt.endsAt)}
			</p>
			<div class="mt-2 flex items-baseline gap-2">
				{#if data.isSustainingMember}
					<span class="text-lg font-bold">{formatCents(discountedPrice)}</span>
					<span class="text-sm line-through opacity-50">{formatCents(unitPrice)}</span>
					<span class="badge badge-success badge-sm">Member 50% off</span>
				{:else}
					<span class="text-lg font-bold">{formatCents(unitPrice)}</span>
				{/if}
				<span class="text-sm opacity-50">per ticket</span>
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
		</div>
	</div>

	{#if soldOut}
		<div class="alert alert-warning">This event is sold out.</div>
	{:else}
		<form onsubmit={handleSubmit}>
			<div class="card bg-base-100 shadow">
				<div class="card-body space-y-4">
					{#if errorMsg}
						<Alert type="error">{errorMsg}</Alert>
					{/if}

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

					<Field name="attendeeName" type="text" label="Name" value={attendeeName} />

					<Field name="attendeeEmail" type="email" label="Email" value={attendeeEmail} />

					<Field name="coverFees" type="checkbox" value={coverFees}
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

					<button
						type="submit"
						class="btn btn-primary w-full"
						disabled={submitting || !attendeeName || !attendeeEmail}
					>
						{#if submitting}
							<span class="loading loading-spinner loading-sm"></span>
						{/if}
						Purchase {quantity === 1 ? 'Ticket' : `${quantity} Tickets`}
					</button>

					{#if !data.isAuthenticated}
						<p class="text-sm text-center opacity-60">
							<a href="/login" class="link">Sign in</a> for member discounts
						</p>
					{/if}
				</div>
			</div>
		</form>
	{/if}
</div>
