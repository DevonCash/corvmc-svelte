<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { compReservation } from '$lib/remote/reservations';

	let {
		reservationId,
		class: className = 'btn-info btn-outline btn-sm',
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
	action={compReservation}
	label="Comp"
	successToast="Reservation comped"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form({ close })}
		<input type="hidden" name="id" value={reservationId} />
		<p class="py-4">Waive payment for this reservation?</p>
	{/snippet}
</Action>
