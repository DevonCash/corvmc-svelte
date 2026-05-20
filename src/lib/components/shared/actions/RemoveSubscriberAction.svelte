<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { actionFetch } from './api';

	let {
		audienceId,
		subscriberId,
		email,
		class: className = 'btn-ghost btn-xs text-error',
		onsuccess,
		...rest
	}: {
		audienceId: string;
		subscriberId: string;
		email: string;
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();
</script>

<Action
	action={() => actionFetch(`/api/marketing/audiences/${audienceId}/subscribers/${subscriberId}`, { method: 'DELETE' })}
	label="Remove"
	confirm={`Remove ${email} from this audience?`}
	successToast="Subscriber removed"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
/>
