<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { actionFetch } from './api';

	let {
		audienceId,
		name,
		class: className = 'btn-ghost btn-xs',
		onsuccess,
		...rest
	}: {
		audienceId: string;
		name: string;
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();
</script>

<Action
	action={() => actionFetch(`/api/me/subscriptions/${audienceId}`, { method: 'DELETE' })}
	label="Unsubscribe"
	successToast={`Unsubscribed from ${name}`}
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
/>
