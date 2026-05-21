<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { confirmReservation } from '$lib/remote/reservations.remote';

	let {
		reservationId,
		class: className = 'btn-success btn-sm',
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
	action={confirmReservation}
	label="Confirm"
	successToast="Confirmed"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form({ close })}
		<input type="hidden" name="id" value={reservationId} />
		<p class="py-4">Confirm this reservation?</p>
	{/snippet}
</Action>
