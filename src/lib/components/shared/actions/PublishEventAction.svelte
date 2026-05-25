<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { publishEvent } from '$lib/remote/events.remote';

	const { fields } = publishEvent;

	let {
		eventId,
		class: className = 'btn-success btn-sm',
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
	action={publishEvent}
	label="Publish"
	successToast="Published"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form({ close })}
		<input {...fields.id.as('hidden', eventId)} />
		<p class="py-2">Publish this event to make it visible to the public?</p>
	{/snippet}
</Action>
