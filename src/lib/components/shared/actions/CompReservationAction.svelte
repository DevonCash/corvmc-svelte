<script lang="ts">
	import Action from '../Action.svelte';
	import ReservationSummary from '../reservations/ReservationSummary.svelte';
	import { invalidateAll } from '$app/navigation';
	import { compReservation } from '$lib/remote/reservations.remote';
	import type { ISODateString } from '$lib/types/dates';

	const { fields } = compReservation;

	let {
		reservation,
		class: className = 'btn-info btn-outline btn-sm',
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
		<input {...fields.id.as('hidden', reservation.id)} />
		<ReservationSummary {reservation} />
		<p class="text-sm">Waive payment for this reservation?</p>
	{/snippet}
</Action>
