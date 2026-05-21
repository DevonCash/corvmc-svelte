<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { cancelReservation } from '$lib/remote/reservations.remote';

	let {
		reservationId,
		showReasonInput = false,
		class: className = 'btn-error btn-outline btn-sm',
		onsuccess,
		...rest
	}: {
		reservationId: string;
		showReasonInput?: boolean;
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();
</script>

<Action
	action={cancelReservation}
	label="Cancel"
	modalTitle={showReasonInput ? 'Cancel Reservation' : undefined}
	successToast="Cancelled"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form({ close })}
		<input type="hidden" name="id" value={reservationId} />
		{#if showReasonInput}
			<p class="text-sm mb-3">Cancel this reservation?</p>
			<input
				type="text"
				name="reason"
				placeholder="Reason (optional)"
				class="input-bordered input input-sm w-full"
			/>
		{:else}
			<p class="py-4">Cancel this reservation?</p>
		{/if}
	{/snippet}
</Action>
