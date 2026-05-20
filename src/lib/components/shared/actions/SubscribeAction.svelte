<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { actionFetch } from './api';

	let {
		audienceId,
		name,
		class: className = 'btn-primary btn-xs',
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
	action={() => actionFetch(`/api/me/subscriptions/${audienceId}`)}
	label="Subscribe"
	successToast={`Subscribed to ${name}`}
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
/>
