<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { updateClosure } from '$lib/remote/closures.remote';

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
	action={updateClosure}
	label="Save"
	successToast="Closure updated"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form({ close })}
		<input type="hidden" name="id" value={closureId} />
		<input type="hidden" name="reason" value={reason} />
		<input type="hidden" name="startsAt" value={startsAt} />
		<input type="hidden" name="endsAt" value={endsAt} />
	{/snippet}
</Action>
