<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { actionFetch } from './api';

	let {
		bandId,
		memberId,
		name,
		class: className = 'btn-ghost btn-xs text-error',
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
	action={() => actionFetch(`/api/bands/${bandId}/members/${memberId}`, { method: 'DELETE' })}
	label="Remove"
	confirm={`Remove ${name} from this band?`}
	successToast="Member removed"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
/>
