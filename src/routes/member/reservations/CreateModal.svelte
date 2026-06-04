<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { bookAndPayReservation } from '$lib/remote/reservations.remote';
	import Action from '$lib/components/shared/Action.svelte';
	import { IconCalendarPlus } from '@tabler/icons-svelte';
	import DateTimeStep from './DateTimeStep.svelte';
	import ConfirmStep from './ConfirmStep.svelte';
	import PaymentStep from './PaymentStep.svelte';

	const { fields } = bookAndPayReservation;

	let {
		isSustaining = false
	}: {
		isSustaining?: boolean;
	} = $props();
</script>

<Action
	action={bookAndPayReservation}
	label="Reserve Space"
	modalTitle="Book a Session"
	noFooter
	class="btn-primary"
	maxWidth="max-w-md"
	onsuccess={async (result) => {
		const r = result as {
			reservationId?: string;
			paid?: boolean;
			confirmed?: boolean;
			waitlisted?: boolean;
			redirectUrl?: string;
		};
		if (r?.redirectUrl) {
			window.location.href = r.redirectUrl;
		} else {
			if (r?.waitlisted) {
				toast.info('The first instance is waitlisted because the slot is currently booked.');
			}
			await invalidateAll();
		}
	}}
>
	{#snippet icon()}<IconCalendarPlus size={18} />{/snippet}
	{#snippet form()}
		<DateTimeStep {isSustaining} />
		<ConfirmStep fields={{ skipPayment: fields.skipPayment }} />
		<PaymentStep fields={{ coverFees: fields.coverFees }} />
	{/snippet}
</Action>
