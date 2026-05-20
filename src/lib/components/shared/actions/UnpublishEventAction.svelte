<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { actionFetch } from './api';

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
	action={() => actionFetch(`/api/events/${eventId}/unpublish`)}
	label="Unpublish"
	confirm="Revert this event to draft? It will no longer be visible to the public."
	successToast="Reverted to draft"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
/>
