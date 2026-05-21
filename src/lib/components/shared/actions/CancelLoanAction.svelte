<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { cancelLoan } from '$lib/remote/equipment';

	let {
		loanId,
		label = 'Cancel',
		confirm: confirmText = 'Cancel this loan?',
		class: className = 'btn-ghost btn-sm text-error',
		onsuccess,
		...rest
	}: {
		loanId: string;
		label?: string;
		confirm?: string;
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();
</script>

<Action
	action={cancelLoan}
	{label}
	modalTitle="Confirm"
	successToast="Loan cancelled"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form({ close })}
		<input type="hidden" name="id" value={loanId} />
		<p class="py-4">{confirmText}</p>
	{/snippet}
</Action>
