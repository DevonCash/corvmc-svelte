<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { actionFetch } from './api';
	import { Field } from '../Form';
	import { equipmentConditions } from '$lib/config';

	let {
		categories,
		class: className = 'btn-primary btn-sm',
		onsuccess,
		...rest
	}: {
		categories: { id: string; name: string }[];
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();

	let name = $state('');
	let description = $state('');
	let categoryId = $state('');
	let condition = $state('good');
	let totalQuantity = $state(1);
	let outOfOrderQuantity = $state(0);
	let serialNumber = $state('');
	let resourceId = $state('');
	let notes = $state('');

	async function execute() {
		const result = await actionFetch('/api/equipment', {
			body: {
				name, description: description || undefined, categoryId,
				condition, totalQuantity, outOfOrderQuantity,
				serialNumber: serialNumber || undefined,
				resourceId: resourceId || undefined,
				notes: notes || undefined
			}
		});
		name = ''; description = ''; categoryId = ''; condition = 'good';
		totalQuantity = 1; outOfOrderQuantity = 0; serialNumber = ''; resourceId = ''; notes = '';
		return result;
	}
</script>

<Action
	action={execute}
	label="Add Equipment"
	modalTitle="Add Equipment"
	successToast="Equipment added"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form({ close })}
		<Field name="name" type="text" label="Name" bind:value={name} />
		<Field name="description" type="textarea" label="Description" bind:value={description} />
		<div class="grid grid-cols-2 gap-3">
			<Field name="categoryId" type="select" label="Category" bind:value={categoryId}
				options={categories.map((c) => ({ value: c.id, label: c.name }))} />
			<Field name="condition" type="select" label="Condition" bind:value={condition}
				options={equipmentConditions.map((c) => ({ value: c, label: c }))} />
		</div>
		<div class="grid grid-cols-2 gap-3">
			<Field name="totalQuantity" type="number" label="Total Quantity" bind:value={totalQuantity} />
			<Field name="outOfOrderQuantity" type="number" label="Out of Order" bind:value={outOfOrderQuantity} />
		</div>
		<div class="grid grid-cols-2 gap-3">
			<Field name="serialNumber" type="text" label="Serial Number" bind:value={serialNumber} />
			<Field name="resourceId" type="text" label="Resource ID" bind:value={resourceId} />
		</div>
		<Field name="notes" type="textarea" label="Notes" bind:value={notes} />
	{/snippet}
</Action>
