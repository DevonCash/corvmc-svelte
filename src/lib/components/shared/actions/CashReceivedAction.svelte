<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { actionFetch } from './api';

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
	action={() => actionFetch(`/api/reservations/${reservationId}/cash-received`)}
	label="Cash received"
	successToast="Marked as paid"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
/>
