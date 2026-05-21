<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { unpublishEvent } from '$lib/remote/events.remote';

	let {
		eventId,
		class: className = 'btn-warning btn-outline btn-sm',
		onsuccess,
		...rest
	}: {
		eventId: string;
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();
</script>

<Action
	action={unpublishEvent}
	label="Unpublish"
	modalTitle="Unpublish Event"
	successToast="Reverted to draft"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form({ close })}
		<input type="hidden" name="id" value={eventId} />
		<p class="py-2">Revert this event to draft? It will no longer be visible to the public.</p>
	{/snippet}
</Action>
