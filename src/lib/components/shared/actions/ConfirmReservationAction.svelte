<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { payForReservation, confirmReservation } from '$lib/remote/reservations.remote';
	import ConfirmStep from '../../../../routes/member/reservations/ConfirmStep.svelte';
	import PaymentStep from '../../../../routes/member/reservations/PaymentStep.svelte';

	let {
		reservation,
		staff = false,
		class: className = 'btn-success btn-sm',
		onsuccess,
		...rest
	}: {
		reservation: { id: string; startsAt: Date; endsAt: Date };
		// Staff confirming on a member's behalf: submit confirmReservation (commits
		// the OWNER's credits) and skip the member-only online Pay Ahead step.
		staff?: boolean;
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();

	const action = $derived(staff ? confirmReservation : payForReservation);
</script>

<Action
	{action}
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
		{#if staff}
			<ConfirmStep {reservation} fields={{ id: confirmReservation.fields.id }} staff />
		{:else}
			<ConfirmStep {reservation} fields={{ id: payForReservation.fields.id }} />
			<PaymentStep
				{reservation}
				fields={{ id: payForReservation.fields.id, coverFees: payForReservation.fields.coverFees }}
			/>
		{/if}
	{/snippet}
</Action>
