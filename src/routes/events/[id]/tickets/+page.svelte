<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import FormField from '$lib/components/shared/Form/FormField.svelte';
	import { formatCents, fullDate, formatTime } from '$lib/utils/format';
	import { enhance } from '$app/forms';

	let { data, form }: { data: any; form: any } = $props();

	let quantity = $state(1);
	let attendeeName = $state('');
	let attendeeEmail = $state('');
	let coverFees = $state(false);
	let submitting = $state(false);

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
</script>

<div class="max-w-lg mx-auto space-y-6">
	<PageHeader title="Get Tickets" backHref="/events" />

	<!-- Event summary -->
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
		<!-- Purchase form -->
		<form
			method="POST"
			action="?/purchase"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					submitting = false;
					await update();
				};
			}}
		>
			<div class="card bg-base-100 shadow">
				<div class="card-body space-y-4">
					{#if form?.error}
						<div class="alert alert-error text-sm">{form.error}</div>
					{/if}

					<FormField label="Number of tickets" id="quantity" issues={[]}>
						<select
							id="quantity"
							name="quantity"
							bind:value={quantity}
							class="select select-bordered w-full"
						>
							{#each Array.from({ length: maxQuantity }, (_, i) => i + 1) as n (n)}
								<option value={n}>{n}</option>
							{/each}
						</select>
					</FormField>

					<FormField label="Name" id="attendeeName" issues={[]}>
						<input
							type="text"
							id="attendeeName"
							name="attendeeName"
							bind:value={attendeeName}
							placeholder="Your name"
							class="input input-bordered w-full"
							required
						/>
					</FormField>

					<FormField label="Email" id="attendeeEmail" issues={[]}>
						<input
							type="email"
							id="attendeeEmail"
							name="attendeeEmail"
							bind:value={attendeeEmail}
							placeholder="your@email.com"
							class="input input-bordered w-full"
							required
						/>
					</FormField>

					<!-- Fee coverage -->
					<label class="label cursor-pointer justify-start gap-3">
						<input
							type="checkbox"
							name="coverFees"
							bind:checked={coverFees}
							class="checkbox checkbox-sm"
						/>
						<span class="label-text">Cover processing fees so the collective receives the full amount</span>
					</label>

					<!-- Total -->
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
							<a href="/demo/better-auth/login" class="link">Sign in</a> for member discounts
						</p>
					{/if}
				</div>
			</div>
		</form>
	{/if}
</div>
