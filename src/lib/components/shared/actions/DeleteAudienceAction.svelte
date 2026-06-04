<script lang="ts">
	import Action from '../Action.svelte';
	import { deleteAudience } from '$lib/remote/marketing.remote';

	const { fields } = deleteAudience;

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
	action={deleteAudience}
	label="Delete"
	modalTitle="Confirm"
	successToast="Audience deleted"
	class={className}
	{onsuccess}
	{...rest}
>
	{#snippet form()}
		<input {...fields.id.as('hidden', audienceId)} />
		<p class="py-4">Delete this audience? All subscribers will be removed.</p>
	{/snippet}
</Action>
