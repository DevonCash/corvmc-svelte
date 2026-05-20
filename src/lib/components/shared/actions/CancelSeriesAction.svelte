<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { actionFetch } from './api';

	let {
		seriesId,
		class: className = 'btn-error btn-outline btn-sm',
		onsuccess,
		...rest
	}: {
		seriesId: string;
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();
</script>

<Action
	action={() => actionFetch(`/api/recurring/${seriesId}/cancel`)}
	label="Cancel Series"
	confirm="Cancel this recurring series? Future reservations will not be created."
	successToast="Series cancelled"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
/>
