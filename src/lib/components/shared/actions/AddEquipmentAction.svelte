<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { createEquipment } from '$lib/remote/equipment';
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
</script>

<Action
	action={createEquipment}
	label="Add Equipment"
	modalTitle="Add Equipment"
	successToast="Equipment added"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form({ close })}
		<Field name="name" type="text" label="Name" />
		<Field name="description" type="textarea" label="Description" />
		<div class="grid grid-cols-2 gap-3">
			<Field name="categoryId" type="select" label="Category"
				options={categories.map((c) => ({ value: c.id, label: c.name }))} />
			<Field name="condition" type="select" label="Condition" value="good"
				options={equipmentConditions.map((c) => ({ value: c, label: c }))} />
		</div>
		<div class="grid grid-cols-2 gap-3">
			<Field name="totalQuantity" type="number" label="Total Quantity" value={1} />
			<Field name="outOfOrderQuantity" type="number" label="Out of Order" value={0} />
		</div>
		<div class="grid grid-cols-2 gap-3">
			<Field name="serialNumber" type="text" label="Serial Number" />
			<Field name="resourceId" type="text" label="Resource ID" />
		</div>
		<Field name="notes" type="textarea" label="Notes" />
	{/snippet}
</Action>
