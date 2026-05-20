<script lang="ts">
	import Action from '../Action.svelte';
	import { actionFetch } from './api';

	let {
		campaignId,
		class: className = 'btn-warning btn-sm',
		onsuccess,
		...rest
	}: {
		campaignId: string;
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();
</script>

<Action
	action={() => actionFetch(`/api/marketing/campaigns/${campaignId}/unschedule`)}
	label="Cancel Schedule"
	successToast="Campaign unscheduled — returned to draft"
	class={className}
	{onsuccess}
	{...rest}
/>
