<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { actionFetch } from './api';

	let {
		closureId,
		reason,
		startsAt,
		endsAt,
		class: className = 'btn-primary btn-sm',
		onsuccess,
		...rest
	}: {
		closureId: string;
		reason: string;
		startsAt: string;
		endsAt: string;
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();
</script>

<Action
	action={() => actionFetch(`/api/staff/closures/${closureId}`, { method: 'PUT', body: { reason, startsAt, endsAt } })}
	label="Save"
	successToast="Closure updated"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
/>
