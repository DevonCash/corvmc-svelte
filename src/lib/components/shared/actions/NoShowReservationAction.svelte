<script lang="ts">
	import Action from '../Action.svelte';
	import ReservationSummary from '../reservations/ReservationSummary.svelte';
	import { invalidateAll } from '$app/navigation';
	import { noShowReservation } from '$lib/remote/reservations.remote';
	import type { ISODateString } from '$lib/types/dates';

	const { fields } = noShowReservation;

	let {
		reservation,
		class: className = 'btn-warning btn-outline btn-sm',
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
	action={noShowReservation}
	label="No-Show"
	modalTitle="Mark as No-Show"
	submitClass="btn-warning"
	successToast="Marked as no-show"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form({ close })}
		<input {...fields.id.as('hidden', reservation.id)} />
		<ReservationSummary {reservation} />
		<p class="text-sm">Mark this reservation as a no-show?</p>
	{/snippet}
</Action>
