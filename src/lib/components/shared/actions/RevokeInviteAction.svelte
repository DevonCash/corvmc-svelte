<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { actionFetch } from './api';

	let {
		bandId,
		memberId,
		name,
		class: className = 'btn-ghost btn-xs text-warning',
		onsuccess,
		...rest
	}: {
		bandId: string;
		memberId: string;
		name: string;
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();
</script>

<Action
	action={() => actionFetch(`/api/bands/${bandId}/members/${memberId}/revoke`)}
	label="Revoke"
	confirm={`Revoke invitation for ${name}?`}
	successToast="Invitation revoked"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
/>
