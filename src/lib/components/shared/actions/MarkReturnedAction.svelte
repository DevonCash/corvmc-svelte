<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { returnLoan } from '$lib/remote/equipment.remote';
	import { Field } from '../Form';

	const { fields } = returnLoan;

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
</script>

<Action
	action={returnLoan}
	label="Mark Returned"
	modalTitle="Confirm Return"
	successToast="Marked as returned"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form()}
		<input {...fields.id.as('hidden', loanId)} />
		{#if chargeMessage}
			<div class="bg-base-200 rounded p-3 mb-3 text-sm">
				<p>{chargeMessage}</p>
			</div>
		{/if}
		<Field field={fields.staffNotes} type="textarea" label="Staff Notes (optional)" />
	{/snippet}
</Action>
