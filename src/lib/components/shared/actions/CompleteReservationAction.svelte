<script lang="ts">
	import Action from '../Action.svelte';
	import ReservationSummary from '../reservations/ReservationSummary.svelte';
	import { invalidateAll } from '$app/navigation';
	import { completeReservation } from '$lib/remote/reservations.remote';
	const { fields } = completeReservation;

	let {
		reservation,
		class: className = 'btn-success btn-sm',
		onsuccess,
		...rest
	}: {
		reservation: { id: string; startsAt: Date; endsAt: Date; memberName?: string };
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();
</script>

<Action
	action={completeReservation}
	label="Complete"
	modalTitle="Complete Reservation"
	submitClass="btn-success"
	successToast="Completed"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form()}
		<input {...fields.id.as('hidden', reservation.id)} />
		<ReservationSummary {reservation} />
		<p class="text-sm">Mark this reservation as completed?</p>
	{/snippet}
</Action>
