<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { cancelRecurringSeries } from '$lib/remote/recurring.remote';

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

	const { fields } = cancelRecurringSeries;
</script>

<Action
	action={cancelRecurringSeries}
	label="Cancel"
	modalTitle="Confirm"
	successToast="Series cancelled"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form()}
		<input {...fields.id.as('hidden', seriesId)} />
		<p class="py-4">Cancel this recurring series? Future reservations will not be created.</p>
	{/snippet}
</Action>
