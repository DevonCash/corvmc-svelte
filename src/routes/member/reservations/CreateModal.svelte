<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { bookAndPayReservation } from '$lib/remote/reservations.remote';
	import Action from '$lib/components/shared/Action.svelte';
	import { IconCalendarPlus } from '@tabler/icons-svelte';
	import DateTimeStep from './DateTimeStep.svelte';
	import ConfirmStep from './ConfirmStep.svelte';
	import PaymentStep from './PaymentStep.svelte';
</script>

<Action
	action={bookAndPayReservation}
	label="Reserve Space"
	modalTitle="Book a Session"
	noFooter
	class="btn-primary"
	maxWidth="max-w-md"
	onsuccess={async (result) => {
		const r = result as { reservationId?: string; paid?: boolean; confirmed?: boolean; redirectUrl?: string };
		if (r?.redirectUrl) {
			window.location.href = r.redirectUrl;
		} else {
			await invalidateAll();
		}
	}}
>
	{#snippet icon()}<IconCalendarPlus size={18} />{/snippet}
	{#snippet form({ close })}
		<DateTimeStep />
		<ConfirmStep />
		<PaymentStep />
	{/snippet}
</Action>
