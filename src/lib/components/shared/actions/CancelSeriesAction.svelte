<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { cancelRecurringSeries } from '$lib/remote/recurring';

	let {
		seriesId,
		class: className = 'btn-error btn-outline btn-sm',
		onsuccess,
		...rest
	}: {
		seriesId: string;
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();
</script>

<Action
	action={cancelRecurringSeries}
	label="Cancel Series"
	modalTitle="Confirm"
	successToast="Series cancelled"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form({ close })}
		<input type="hidden" name="id" value={seriesId} />
		<p class="py-4">Cancel this recurring series? Future reservations will not be created.</p>
	{/snippet}
</Action>
