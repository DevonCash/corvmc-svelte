<script lang="ts">
	import Action from '../Action.svelte';
	import ReservationSummary from '../reservations/ReservationSummary.svelte';
	import { invalidateAll } from '$app/navigation';
	import { cancelReservation } from '$lib/remote/reservations.remote';
	import type { ISODateString } from '$lib/types/dates';

	let {
		reservation,
		showReasonInput = false,
		class: className = 'btn-error btn-outline btn-sm',
		onsuccess,
		...rest
	}: {
		reservation: { id: string; startsAt: ISODateString; endsAt: ISODateString; memberName?: string };
		showReasonInput?: boolean;
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();
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
	{#snippet form({ close })}
		<input type="hidden" name="id" value={reservation.id} />
		<ReservationSummary {reservation} />
		<p class="text-sm">Are you sure you want to cancel this reservation?</p>
		{#if showReasonInput}
			<input
				type="text"
				name="reason"
				placeholder="Reason (optional)"
				class="input-bordered input input-sm w-full"
			/>
		{/if}
	{/snippet}
</Action>
