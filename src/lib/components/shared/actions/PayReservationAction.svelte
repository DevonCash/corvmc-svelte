<script lang="ts">
	import Action from '../Action.svelte';
	import ReservationSummary from '../reservations/ReservationSummary.svelte';
	import { invalidateAll } from '$app/navigation';
	import { payForReservation } from '$lib/remote/reservations.remote';
	import PaymentStep from '../../../../routes/member/reservations/PaymentStep.svelte';
	import type { Reservation } from '$lib/server/reservation';

	const { fields } = payForReservation;

	let {
		reservation,
		label = 'Pay Now',
		class: className = 'btn-primary btn-sm',
		...rest
	}: {
		reservation: Reservation;
		label?: string;
		class?: string;
		[key: string]: unknown;
	} = $props();
</script>

<Action
	action={payForReservation}
	{label}
	modalTitle="Pay for Your Session"
	noFooter
	maxWidth="max-w-md"
	class={className}
	onsuccess={async (result) => {
		const r = result as { paid?: boolean; redirectUrl?: string };
		if (r?.redirectUrl) {
			window.location.href = r.redirectUrl;
		} else {
			await invalidateAll();
		}
	}}
	{...rest}
>
	{#snippet form()}
		<ReservationSummary {reservation} />
		<PaymentStep
			{reservation}
			fields={{ id: fields.id, coverFees: fields.coverFees }}
			precedingSteps={0}
		/>
	{/snippet}
</Action>
