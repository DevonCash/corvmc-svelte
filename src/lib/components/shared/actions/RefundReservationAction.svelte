<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { refundReservation } from '$lib/remote/reservations.remote';

	let {
		reservationId,
		class: className = 'btn-error btn-outline btn-sm',
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
	action={refundReservation}
	label="Refund"
	successToast="Payment refunded"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form({ close })}
		<input type="hidden" name="id" value={reservationId} />
		<p class="py-4">Refund the payment for this reservation? This does not cancel the reservation.</p>
	{/snippet}
</Action>
