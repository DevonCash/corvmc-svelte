<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { actionFetch } from './api';

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
	action={() => actionFetch(`/api/reservations/${reservationId}/comp`)}
	label="Comp"
	confirm="Waive payment for this reservation?"
	successToast="Reservation comped"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
/>
