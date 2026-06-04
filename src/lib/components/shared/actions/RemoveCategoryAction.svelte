<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { removeCategory } from '$lib/remote/equipment.remote';

	const { fields } = removeCategory;

	let {
		categoryId,
		name,
		class: className = 'text-error btn-ghost btn-xs',
		onsuccess,
		...rest
	}: {
		categoryId: string;
		name: string;
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();
</script>

<Action
	action={removeCategory}
	label="Delete"
	modalTitle="Confirm"
	successToast="Category deleted"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form()}
		<input {...fields.id.as('hidden', categoryId)} />
		<p class="py-4">Delete "{name}"? Category must have no equipment.</p>
	{/snippet}
</Action>
