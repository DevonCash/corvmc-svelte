<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { bulkAddMembers } from '$lib/remote/marketing.remote';

	const { fields } = bulkAddMembers;

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
	action={bulkAddMembers}
	label="Add all active members"
	modalTitle="Confirm"
	successToast="Members added"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form()}
		<input {...fields.audienceId.as('hidden', audienceId)} />
		<p class="py-4">Add all active members to this audience?</p>
	{/snippet}
</Action>
