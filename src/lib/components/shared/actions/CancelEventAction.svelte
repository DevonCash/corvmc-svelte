<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { cancelEvent } from '$lib/remote/events.remote';

	const { fields } = cancelEvent;

	let {
		eventId,
		class: className = 'btn-error btn-outline btn-sm',
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
	action={cancelEvent}
	label="Cancel Event"
	modalTitle="Cancel Event"
	successToast="Cancelled"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form({ close })}
		<input {...fields.id.as('hidden', eventId)} />
		<p class="py-2">Cancel this event? This cannot be undone.</p>
	{/snippet}
</Action>
