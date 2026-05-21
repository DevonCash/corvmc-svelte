<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { unsubscribe } from '$lib/remote/account.remote';

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
	action={unsubscribe}
	label="Unsubscribe"
	modalTitle="Unsubscribe"
	successToast={`Unsubscribed from ${name}`}
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form({ close })}
		<input type="hidden" name="audienceId" value={audienceId} />
		<p class="py-4">Unsubscribe from {name}?</p>
	{/snippet}
</Action>
