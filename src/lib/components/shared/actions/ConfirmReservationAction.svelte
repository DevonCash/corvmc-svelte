<script lang="ts">
	import Action from '../Action.svelte';
	import ReservationSummary from '../ReservationSummary.svelte';
	import { invalidateAll } from '$app/navigation';
	import { confirmReservation } from '$lib/remote/reservations.remote';

	let {
		reservation,
		class: className = 'btn-success btn-sm',
		onsuccess,
		...rest
	}: {
		reservation: { id: string; startsAt: string; endsAt: string; memberName?: string };
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();
</script>

<Action
	action={confirmReservation}
	label="Confirm"
	modalTitle="Confirm Reservation"
	submitClass="btn-success"
	successToast="Confirmed"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form({ close })}
		<input type="hidden" name="id" value={reservation.id} />
		<ReservationSummary {reservation} />
		<p class="text-sm">Confirm this reservation?</p>
	{/snippet}
</Action>
