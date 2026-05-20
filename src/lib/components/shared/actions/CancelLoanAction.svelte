<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { actionFetch } from './api';

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
	action={() => actionFetch(`/api/equipment/loans/${loanId}/cancel`)}
	{label}
	confirm={confirmText}
	successToast="Loan cancelled"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
/>
