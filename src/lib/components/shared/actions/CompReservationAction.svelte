<script lang="ts">
	import Action from '../Action.svelte';
	import ReservationSummary from '../ReservationSummary.svelte';
	import { invalidateAll } from '$app/navigation';
	import { compReservation } from '$lib/remote/reservations.remote';

	let {
		reservation,
		class: className = 'btn-info btn-outline btn-sm',
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
	action={compReservation}
	label="Comp"
	modalTitle="Comp Reservation"
	submitClass="btn-info"
	successToast="Reservation comped"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form({ close })}
		<input type="hidden" name="id" value={reservation.id} />
		<ReservationSummary {reservation} />
		<p class="text-sm">Waive payment for this reservation?</p>
	{/snippet}
</Action>
