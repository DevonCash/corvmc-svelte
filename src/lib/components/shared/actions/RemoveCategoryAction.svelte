<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { actionFetch } from './api';

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
	action={() => actionFetch(`/api/equipment/categories/${categoryId}`, { method: 'DELETE' })}
	label="Delete"
	confirm='Delete "{name}"? Category must have no equipment.'
	successToast="Category deleted"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
/>
