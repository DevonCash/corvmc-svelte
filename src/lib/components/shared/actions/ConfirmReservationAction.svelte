<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { payForReservation } from '$lib/remote/reservations.remote';
	import ConfirmStep from '../../../../routes/member/reservations/ConfirmStep.svelte';
	import PaymentStep from '../../../../routes/member/reservations/PaymentStep.svelte';
	const { fields } = payForReservation;

	let {
		reservation,
		class: className = 'btn-success btn-sm',
		onsuccess,
		...rest
	}: {
		reservation: { id: string; startsAt: Date; endsAt: Date };
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();
</script>

<Action
	action={payForReservation}
	label="Confirm"
	modalTitle="Confirm Reservation"
	noFooter
	maxWidth="max-w-md"
	successToast="Confirmed"
	class={className}
	onsuccess={async (result) => {
		const r = result as { paid?: boolean; confirmed?: boolean; redirectUrl?: string };
		if (r?.redirectUrl) {
			window.location.href = r.redirectUrl;
		} else {
			if (onsuccess) onsuccess();
			else await invalidateAll();
		}
	}}
	{...rest}
>
	{#snippet form()}
		<ConfirmStep {reservation} fields={{ id: fields.id }} />
		<PaymentStep {reservation} fields={{ id: fields.id, coverFees: fields.coverFees }} />
	{/snippet}
</Action>
