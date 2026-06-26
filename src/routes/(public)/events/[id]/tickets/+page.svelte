<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import { Field } from '$lib/components/shared/Form';
	import { formatCents, fullDate, formatTime } from '$lib/utils/format';
	import { calculateTotalWithFeeCoverage } from '$lib/finance/fees';
	import Badge from '$lib/components/shared/Badge.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import { IconHeartHandshake } from '@tabler/icons-svelte';
	import { purchaseTickets, rsvpForEvent, getPublicTicketPage } from '$lib/remote/events.remote';

	const purchaseFields = purchaseTickets.fields;
	const rsvpFields = rsvpForEvent.fields;

	let data = $derived(await getPublicTicketPage(page.params.id!));

	let quantity = $state(1);
	let attendeeName = $state('');
	let attendeeEmail = $state('');
	let coverFees = $state(false);

	const evt = $derived(data.event);
	const isFreeEvent = $derived(!evt.ticketPrice || evt.ticketPrice === 0);
	const unitPrice = $derived(evt.ticketPrice ?? 0);
	const discountedPrice = $derived(data.isSustainingMember ? Math.round(unitPrice / 2) : unitPrice);
	const subtotal = $derived(discountedPrice * quantity);
	const memberSubtotal = $derived(Math.round(unitPrice / 2) * quantity);
	const memberSavings = $derived(subtotal - memberSubtotal);
	const feeCents = $derived(calculateTotalWithFeeCoverage(subtotal).feeCents);
	const total = $derived(coverFees ? subtotal + feeCents : subtotal);
	const soldOut = $derived(data.remaining === 0);
	const maxQuantity = $derived(data.remaining !== null ? Math.min(data.remaining, 10) : 10);

	async function handleSuccess(result?: { redirectUrl?: string }) {
		if (result?.redirectUrl) {
			if (result.redirectUrl.startsWith('http')) {
				window.location.href = result.redirectUrl;
			} else {
				await goto(result.redirectUrl);
			}
		}
	}
</script>

<div class="max-w-lg mx-auto space-y-6">
	<PageHeader title={isFreeEvent ? 'RSVP' : 'Get Tickets'} backHref="/events" />

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
			{#if !isFreeEvent}
				<div class="mt-2 flex items-baseline gap-2">
					{#if data.isSustainingMember}
						<span class="text-lg font-bold">{formatCents(discountedPrice)}</span>
						<span class="text-sm line-through opacity-50">{formatCents(unitPrice)}</span>
						<Badge variant="success">Member 50% off</Badge>
					{:else}
						<span class="text-lg font-bold">{formatCents(unitPrice)}</span>
					{/if}
					<span class="text-sm opacity-50">per ticket</span>
				</div>
			{:else}
				<div class="mt-2">
					<Badge variant="info">Free event</Badge>
				</div>
			{/if}
			{#if data.remaining !== null}
				<p class="text-sm mt-1">
					{#if soldOut}
						<span class="text-error font-medium">{isFreeEvent ? 'Full' : 'Sold out'}</span>
					{:else}
						{data.remaining} {isFreeEvent ? 'spots' : 'tickets'} remaining
					{/if}
				</p>
			{/if}
		</div>
	</div>

	{#if soldOut}
		<div class="alert alert-warning">This event is {isFreeEvent ? 'full' : 'sold out'}.</div>
	{:else if isFreeEvent}
		<Form
			remote={rsvpForEvent}
			onsuccess={handleSuccess}
			onfailure={() => toast.error('Something went wrong')}
		>
			<input {...rsvpFields.eventId.as('hidden', page.params.id!)} />
			<div class="card bg-base-100 shadow">
				<div class="card-body space-y-4">
					<Field label="Number of spots" name="quantity">
						<select name="quantity" bind:value={quantity} class="select select-bordered w-full">
							{#each Array.from({ length: maxQuantity }, (_, i) => i + 1) as n (n)}
								<option value={n}>{n}</option>
							{/each}
						</select>
					</Field>

					{#if !data.isAuthenticated}
						<Field name="attendeeName" type="text" label="Name" value={attendeeName} />

						<Field name="attendeeEmail" type="email" label="Email" value={attendeeEmail} />
					{/if}

					<SubmitButton
						label="RSVP{quantity > 1 ? ` for ${quantity}` : ''}"
						class="btn-primary w-full"
					/>
				</div>
			</div>
		</Form>
	{:else}
		{#if !data.isSustainingMember}
			<div class="card border border-primary/30 bg-primary/5">
				<div class="card-body gap-3 p-4">
					<div class="flex items-center gap-2">
						<IconHeartHandshake size={20} class="text-primary" />
						<h3 class="font-semibold">Save 50% as a sustaining member</h3>
					</div>
					<p class="text-sm opacity-80">
						Sustaining members pay
						<span class="font-semibold">{formatCents(memberSubtotal)}</span> for this order — you'd
						save {formatCents(memberSavings)}. Plus free practice hours, gear discounts, and 50% off
						every show.
					</p>
					{#if data.isAuthenticated}
						<Button href={resolve('/member/membership')} class="btn-primary btn-sm self-start">
							Become a Sustaining Member
						</Button>
					{:else}
						<Button
							href="{resolve('/login')}?redirect={encodeURIComponent(page.url.pathname)}"
							class="btn-primary btn-sm self-start"
						>
							Sign in &amp; save 50%
						</Button>
					{/if}
				</div>
			</div>
		{/if}
		<Form
			remote={purchaseTickets}
			onsuccess={handleSuccess}
			onfailure={() => toast.error('Something went wrong')}
		>
			<input {...purchaseFields.eventId.as('hidden', page.params.id!)} />
			<div class="card bg-base-100 shadow">
				<div class="card-body space-y-4">
					<Field label="Number of tickets" name="quantity">
						<select name="quantity" bind:value={quantity} class="select select-bordered w-full">
							{#each Array.from({ length: maxQuantity }, (_, i) => i + 1) as n (n)}
								<option value={n}>{n}</option>
							{/each}
						</select>
					</Field>

					{#if !data.isAuthenticated}
						<Field name="attendeeName" type="text" label="Name" value={attendeeName} />

						<Field name="attendeeEmail" type="email" label="Email" value={attendeeEmail} />
					{/if}

					<Field
						name="coverFees"
						type="checkbox"
						bind:value={coverFees}
						checkboxLabel="Add {formatCents(
							feeCents
						)} to cover processing fees so the collective receives the full amount"
					/>

					<div class="border-t border-base-200 pt-4">
						{#if coverFees}
							<div class="flex justify-between text-sm opacity-70">
								<span>Subtotal</span>
								<span>{formatCents(subtotal)}</span>
							</div>
							<div class="flex justify-between text-sm opacity-70">
								<span>Processing fees</span>
								<span>{formatCents(feeCents)}</span>
							</div>
						{/if}
						<div class="flex justify-between text-lg font-medium">
							<span>Total</span>
							<span>{formatCents(total)}</span>
						</div>
						{#if data.isSustainingMember}
							<p class="text-sm text-success mt-1">Sustaining member discount applied</p>
						{/if}
					</div>

					<SubmitButton
						label="Purchase {quantity === 1 ? 'Ticket' : `${quantity} Tickets`}"
						class="btn-primary w-full"
					/>
				</div>
			</div>
		</Form>
	{/if}
</div>
