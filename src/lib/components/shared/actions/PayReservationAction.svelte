<script lang="ts">
	import Action from '../Action.svelte';
	import ReservationSummary from '../ReservationSummary.svelte';
	import { invalidateAll } from '$app/navigation';
	import { payForReservation } from '$lib/remote/reservations.remote';
	import PaymentStep from '../../../../routes/member/reservations/PaymentStep.svelte';

	let {
		reservation,
		class: className = 'btn-primary btn-sm',
		...rest
	}: {
		reservation: { id: string; startsAt: string; endsAt: string };
		class?: string;
		[key: string]: unknown;
	} = $props();
</script>

<Action
	action={payForReservation}
	label="Pay Now"
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
	{#snippet form({ close })}
		<ReservationSummary {reservation} />
		<PaymentStep {reservation} />
	{/snippet}
</Action>
