<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { actionFetch } from './api';

	let {
		audienceId,
		class: className = 'btn-outline btn-sm',
		onsuccess,
		...rest
	}: {
		audienceId: string;
		class?: string;
		onsuccess?: (result: unknown) => void;
		[key: string]: unknown;
	} = $props();
</script>

<Action
	action={() => actionFetch(`/api/marketing/audiences/${audienceId}/bulk-add`)}
	label="Add all active members"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
/>
