<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { actionFetch } from './api';

	let {
		eventId,
		ticketId,
		attendeeName,
		class: className = 'btn-ghost btn-sm text-error',
		onsuccess,
		...rest
	}: {
		eventId: string;
		ticketId: string;
		attendeeName: string;
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();
</script>

<Action
	action={() => actionFetch(`/api/events/${eventId}/tickets/${ticketId}/cancel`)}
	label="Cancel"
	confirm={`Cancel ticket for ${attendeeName}?`}
	successToast="Ticket cancelled"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
/>
