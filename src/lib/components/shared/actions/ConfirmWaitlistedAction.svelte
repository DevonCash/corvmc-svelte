<script lang="ts">
	import Action from '../Action.svelte';
	import ReservationSummary from '../ReservationSummary.svelte';
	import { invalidateAll } from '$app/navigation';
	import { confirmWaitlisted } from '$lib/remote/reservations.remote';
	import { formatDate } from '$lib/utils/format';

	let {
		reservation,
		class: className = 'btn-success btn-sm',
		onsuccess,
		...rest
	}: {
		reservation: {
			id: string;
			startsAt: string;
			endsAt: string;
			waitlistExpiresAt?: string | null;
		};
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();
</script>

<Action
	action={confirmWaitlisted}
	label="Confirm Slot"
	modalTitle="Confirm Waitlisted Reservation"
	submitLabel="Confirm Reservation"
	submitClass="btn-success"
	successToast="Reservation confirmed"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form({ close })}
		<input type="hidden" name="id" value={reservation.id} />
		<ReservationSummary {reservation} />
		<p class="text-sm">
			A slot has opened up for this time. Would you like to confirm this reservation?
		</p>
		{#if reservation.waitlistExpiresAt}
			<p class="text-xs opacity-60">
				You have until {formatDate(reservation.waitlistExpiresAt)} to confirm before the slot is offered to someone else.
			</p>
		{/if}
	{/snippet}
</Action>
