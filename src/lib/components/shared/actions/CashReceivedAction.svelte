<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { cashReceivedReservation } from '$lib/remote/reservations.remote';

	let {
		reservationId,
		class: className = 'btn-success btn-outline btn-sm',
		onsuccess,
		...rest
	}: {
		reservationId: string;
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();
</script>

<Action
	action={cashReceivedReservation}
	label="Cash received"
	successToast="Marked as paid"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form({ close })}
		<input type="hidden" name="id" value={reservationId} />
		<p class="py-4">Record cash payment for this reservation?</p>
	{/snippet}
</Action>
