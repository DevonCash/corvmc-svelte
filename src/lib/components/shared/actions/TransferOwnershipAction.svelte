<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { transferOwnership } from '$lib/remote/bands.remote';

	const { fields } = transferOwnership;

	let {
		bandId,
		newOwnerId,
		name,
		class: className = 'btn-ghost btn-xs',
		onsuccess,
		...rest
	}: {
		bandId: string;
		newOwnerId: string;
		name: string;
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();
</script>

<Action
	action={transferOwnership}
	label="Make owner"
	modalTitle="Confirm"
	successToast="Ownership transferred"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form({ close })}
		<input {...fields.bandId.as('hidden', bandId)} />
		<input {...fields.newOwnerId.as('hidden', newOwnerId)} />
		<p class="py-4">Transfer ownership to {name}? The current owner will be demoted to admin.</p>
	{/snippet}
</Action>
