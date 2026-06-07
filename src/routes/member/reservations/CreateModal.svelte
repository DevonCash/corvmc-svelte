<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { bookAndPayReservation } from '$lib/remote/reservations.remote';
	import Action from '$lib/components/shared/Action.svelte';
	import { IconCalendarPlus } from '@tabler/icons-svelte';
	import DateTimeStep from './DateTimeStep.svelte';
	import ConfirmStep from './ConfirmStep.svelte';
	import PaymentStep from './PaymentStep.svelte';
	import BookingConflict from './BookingConflict.svelte';

	const { fields } = bookAndPayReservation;

	// Bumped when a slot conflict sends the wizard back to step 1, forcing the
	// Date/Time step to reload availability so the just-taken slot disappears.
	let reloadToken = $state(0);

	let {
		isSustaining = false,
		onbooked
	}: {
		isSustaining?: boolean;
		onbooked?: () => void;
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
			onbooked?.();
		}
	}}
>
	{#snippet icon()}<IconCalendarPlus size={18} />{/snippet}
	{#snippet form()}
		<DateTimeStep {isSustaining} {reloadToken} />
		<ConfirmStep />
		<PaymentStep fields={{ coverFees: fields.coverFees }} />
		<BookingConflict result={bookAndPayReservation.result} onconflict={() => reloadToken++} />
	{/snippet}
</Action>
