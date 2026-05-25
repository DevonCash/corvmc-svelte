<script lang="ts">
	import Action from '../Action.svelte';
	import ReservationSummary from '../reservations/ReservationSummary.svelte';
	import { invalidateAll } from '$app/navigation';
	import { cashReceivedReservation } from '$lib/remote/reservations.remote';
	import type { ISODateString } from '$lib/types/dates';

	const { fields } = cashReceivedReservation;

	let {
		reservation,
		class: className = 'btn-success btn-outline btn-sm',
		onsuccess,
		...rest
	}: {
		reservation: { id: string; startsAt: ISODateString; endsAt: ISODateString; memberName?: string };
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();
</script>

<Action
	action={cashReceivedReservation}
	label="Cash received"
	modalTitle="Record Cash Payment"
	submitClass="btn-success"
	successToast="Marked as paid"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form({ close })}
		<input {...fields.id.as('hidden', reservation.id)} />
		<ReservationSummary {reservation} />
		<p class="text-sm">Record that cash was received for this reservation?</p>
	{/snippet}
</Action>
