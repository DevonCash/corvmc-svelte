<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { bookMemberReservation } from '$lib/remote/reservations.remote';
	import Action from '$lib/components/shared/Action.svelte';
	import { IconRepeat } from '@tabler/icons-svelte';
	import RecurringConfigStep from './RecurringConfigStep.svelte';
	import RecurringConfirmStep from './RecurringConfirmStep.svelte';
</script>

<Action
	action={bookMemberReservation}
	label="New Recurring"
	modalTitle="New Recurring Reservation"
	class="btn-ghost btn-sm"
	maxWidth="max-w-md"
	noFooter
	successToast="Recurring series created"
	onsuccess={(result) => {
		const r = result as { waitlisted?: boolean } | undefined;
		if (r?.waitlisted) {
			toast.info('The first instance is waitlisted because the slot is currently booked.');
		}
		invalidateAll();
	}}
>
	{#snippet icon()}<IconRepeat size={16} />{/snippet}
	{#snippet form({ close })}
		<RecurringConfigStep />
		<RecurringConfirmStep />
	{/snippet}
</Action>
