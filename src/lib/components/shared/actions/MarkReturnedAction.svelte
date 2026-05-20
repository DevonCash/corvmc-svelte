<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { actionFetch } from './api';
	import { Field } from '../Form';

	let {
		loanId,
		chargeMessage,
		class: className = 'btn-primary btn-sm',
		onsuccess,
		...rest
	}: {
		loanId: string;
		chargeMessage?: string;
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();

	let staffNotes = $state('');

	function execute() {
		const result = actionFetch(`/api/equipment/loans/${loanId}/return`, {
			body: staffNotes ? { staffNotes } : undefined
		});
		staffNotes = '';
		return result;
	}
</script>

<Action
	action={execute}
	label="Mark Returned"
	modalTitle="Confirm Return"
	successToast="Marked as returned"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form({ close })}
		{#if chargeMessage}
			<div class="bg-base-200 rounded p-3 mb-3 text-sm">
				<p>{chargeMessage}</p>
			</div>
		{/if}
		<Field name="staffNotes" type="textarea" label="Staff Notes (optional)" bind:value={staffNotes} />
	{/snippet}
</Action>
