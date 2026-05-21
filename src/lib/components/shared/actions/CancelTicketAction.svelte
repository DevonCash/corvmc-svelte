<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { cancelTicket } from '$lib/remote/events.remote';

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
	action={cancelTicket}
	label="Cancel"
	modalTitle="Cancel Ticket"
	successToast="Ticket cancelled"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form({ close })}
		<input type="hidden" name="ticketId" value={ticketId} />
		<p class="py-2">Cancel ticket for {attendeeName}?</p>
	{/snippet}
</Action>
