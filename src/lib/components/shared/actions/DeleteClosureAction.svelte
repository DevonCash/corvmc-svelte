<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { actionFetch } from './api';

	let {
		closureId,
		class: className = 'btn-ghost btn-sm text-error',
		onsuccess,
		...rest
	}: {
		closureId: string;
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();
</script>

<Action
	action={() => actionFetch(`/api/staff/closures/${closureId}`, { method: 'DELETE' })}
	label="Delete"
	confirm="Delete this closure?"
	successToast="Closure deleted"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
/>
