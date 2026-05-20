<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { actionFetch } from './api';

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
	action={() => actionFetch(`/api/bands/${bandId}/transfer-ownership`, { body: { newOwnerId } })}
	label="Make owner"
	confirm={`Transfer ownership to ${name}? The current owner will be demoted to admin.`}
	successToast="Ownership transferred"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
/>
