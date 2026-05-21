<script lang="ts">
	import Action from '../Action.svelte';
	import { unscheduleCampaign } from '$lib/remote/marketing';

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
	action={unscheduleCampaign}
	label="Cancel Schedule"
	modalTitle="Confirm"
	successToast="Campaign unscheduled — returned to draft"
	class={className}
	{onsuccess}
	{...rest}
>
	{#snippet form({ close })}
		<input type="hidden" name="campaignId" value={campaignId} />
		<p class="py-4">Cancel the scheduled send and return this campaign to draft?</p>
	{/snippet}
</Action>
