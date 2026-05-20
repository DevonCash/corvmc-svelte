<script lang="ts">
	import Action from '../Action.svelte';
	import { actionFetch } from './api';

	let {
		audienceId,
		class: className = 'btn-error btn-sm',
		onsuccess,
		...rest
	}: {
		audienceId: string;
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();
</script>

<Action
	action={() => actionFetch(`/api/marketing/audiences/${audienceId}`, { method: 'DELETE' })}
	label="Delete"
	confirm="Delete this audience? All subscribers will be removed."
	successToast="Audience deleted"
	class={className}
	{onsuccess}
	{...rest}
/>
