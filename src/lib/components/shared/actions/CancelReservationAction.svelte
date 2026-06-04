<script lang="ts">
	import Action from '../Action.svelte';
	import ReservationSummary from '../reservations/ReservationSummary.svelte';
	import { invalidateAll } from '$app/navigation';
	import { cancelReservation } from '$lib/remote/reservations.remote';
	import type { Reservation } from '$lib/server/reservation';

	let {
		reservation,
		showReasonInput = false,
		class: className = 'btn-error btn-outline btn-sm',
		onsuccess,
		...rest
	}: {
		reservation: Reservation;
		showReasonInput?: boolean;
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();

	const { fields } = cancelReservation;
</script>

<Action
	action={cancelReservation}
	label="Cancel"
	modalTitle="Cancel Reservation"
	submitClass="btn-error"
	successToast="Cancelled"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form()}
		<input {...fields.id.as('hidden', reservation.id)} />
		<ReservationSummary {reservation} />
		<p class="text-sm">Are you sure you want to cancel this reservation?</p>
		{#if showReasonInput}
			<input
				{...fields.reason.as('text')}
				placeholder="Reason (optional)"
				class="input-bordered input input-sm w-full"
			/>
		{/if}
	{/snippet}
</Action>
