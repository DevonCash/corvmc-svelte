<script lang="ts">
	import Action from '../Action.svelte';
	import ReservationSummary from '../reservations/ReservationSummary.svelte';
	import { invalidateAll } from '$app/navigation';
	import { refundReservation } from '$lib/remote/reservations.remote';
	import type { ISODateString } from '$lib/types/dates';

	const { fields } = refundReservation;

	let {
		reservation,
		class: className = 'btn-error btn-outline btn-sm',
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
	action={refundReservation}
	label="Refund"
	modalTitle="Refund Payment"
	submitClass="btn-error"
	successToast="Payment refunded"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form({ close })}
		<input {...fields.id.as('hidden', reservation.id)} />
		<ReservationSummary {reservation} />
		<p class="text-sm">Refund the payment for this reservation? This does not cancel the reservation.</p>
	{/snippet}
</Action>
