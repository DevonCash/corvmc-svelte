<script lang="ts">
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import Column from '$lib/components/shared/Table/Column.svelte';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import AsyncButton from '$lib/components/shared/AsyncButton.svelte';
	import { addEquipment, addCategory, editCategory, removeCategory } from './data.remote';
	import { equipmentConditions, equipmentStatuses, pricingTiers, type EquipmentCondition, type EquipmentStatus, type PricingTier } from '$lib/server/equipment/types';
	import type { StaffEquipmentResponse } from '$lib/types/api';

	let { data }: { data: StaffEquipmentResponse } = $props();

	let showAddModal = $state(false);
	let showCategoryModal = $state(false);

	// Category management
	let editingCategory = $state<null | { id: string; name: string; displayOrder: number; pricingTier: PricingTier }>(null);

	// Add equipment form state
	let newEquipment = $state({
		name: '',
		description: '',
		categoryId: '',
		totalQuantity: 1,
		outOfOrderQuantity: 0,
		serialNumber: '',
		resourceId: '',
		condition: 'good' as EquipmentCondition,
		status: 'available' as EquipmentStatus,
		notes: ''
	});

	function resetNewEquipment() {
		newEquipment = {
			name: '', description: '', categoryId: '', totalQuantity: 1,
			outOfOrderQuantity: 0, serialNumber: '', resourceId: '',
			condition: 'good', status: 'available', notes: ''
		};
	}
</script>

<div class="space-y-6">
	<PageHeader title="Equipment">
		<div class="flex gap-2">
			<button class="btn btn-sm btn-ghost" onclick={() => (showCategoryModal = true)}>
				Categories
			</button>
			<button class="btn btn-sm btn-primary" onclick={() => (showAddModal = true)}>
				Add Equipment
			</button>
		</div>
	</PageHeader>

	<!-- Filters -->
	<form method="get" class="flex flex-wrap items-end gap-2">
		<input
			type="text"
			name="q"
			value={data.filters.search}
			placeholder="Search name, serial, resource ID..."
			class="input-bordered input input-sm w-64"
		/>
		<select name="category" class="select-bordered select select-sm">
			<option value="">All categories</option>
			{#each data.categories as cat}
				<option value={cat.id} selected={data.filters.categoryId === cat.id}>{cat.name}</option>
			{/each}
		</select>
		<select name="status" class="select-bordered select select-sm">
			<option value="">All statuses</option>
			{#each equipmentStatuses as s}
				<option value={s} selected={data.filters.status === s}>{s}</option>
			{/each}
		</select>
		<button type="submit" class="btn btn-sm btn-primary">Filter</button>
		{#if data.filters.search || data.filters.categoryId || data.filters.status}
			<a href="/staff/equipment" class="btn btn-ghost btn-sm">Clear</a>
		{/if}
	</form>

	<!-- Equipment Table -->
	<DataTable data={data.equipment} rowHref={(e) => `/staff/equipment/${e.id}`} empty="No equipment found">
		<Column key="name" header="Name" sortable />
		<Column key="categoryName" header="Category" sortable>
			{#snippet cell(_, e)}
				{e.category.name}
			{/snippet}
		</Column>
		<Column key="status" header="Status" shrink>
			{#snippet cell(_, e)}
				<StatusBadge status={e.status} />
			{/snippet}
		</Column>
		<Column key="condition" header="Condition" shrink>
			{#snippet cell(_, e)}
				<span class="badge badge-outline badge-sm">{e.condition}</span>
			{/snippet}
		</Column>
		<Column key="availableQuantity" header="Available" shrink sortable>
			{#snippet cell(_, e)}
				<span class:text-error={e.availableQuantity <= 0}>
					{e.availableQuantity} / {e.totalQuantity}
				</span>
			{/snippet}
		</Column>
		<Column key="resourceId" header="Resource ID" shrink>
			{#snippet cell(_, e)}
				{#if e.resourceId}
					<span class="font-mono text-xs">{e.resourceId}</span>
				{:else}
					<span class="opacity-40">—</span>
				{/if}
			{/snippet}
		</Column>
	</DataTable>
</div>

<!-- Add Equipment Modal -->
{#if showAddModal}
	<dialog class="modal modal-open">
		<div class="modal-box max-w-lg">
			<h3 class="font-bold text-lg mb-4">Add Equipment</h3>
			<form
				onsubmit={async (e) => {
					e.preventDefault();
					await addEquipment({
						...newEquipment,
						description: newEquipment.description || undefined,
						serialNumber: newEquipment.serialNumber || undefined,
						resourceId: newEquipment.resourceId || undefined,
						notes: newEquipment.notes || undefined
					});
					showAddModal = false;
					resetNewEquipment();
					window.location.reload();
				}}
				class="space-y-3"
			>
				<div>
					<label class="label label-text" for="eq-name">Name</label>
					<input id="eq-name" type="text" class="input input-bordered w-full" bind:value={newEquipment.name} required />
				</div>
				<div>
					<label class="label label-text" for="eq-desc">Description</label>
					<textarea id="eq-desc" class="textarea textarea-bordered w-full" bind:value={newEquipment.description}></textarea>
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="label label-text" for="eq-cat">Category</label>
						<select id="eq-cat" class="select select-bordered w-full" bind:value={newEquipment.categoryId} required>
							<option value="" disabled>Select...</option>
							{#each data.categories as cat}
								<option value={cat.id}>{cat.name}</option>
							{/each}
						</select>
					</div>
					<div>
						<label class="label label-text" for="eq-condition">Condition</label>
						<select id="eq-condition" class="select select-bordered w-full" bind:value={newEquipment.condition}>
							{#each equipmentConditions as c}
								<option value={c}>{c}</option>
							{/each}
						</select>
					</div>
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="label label-text" for="eq-qty">Total Quantity</label>
						<input id="eq-qty" type="number" min="1" class="input input-bordered w-full" bind:value={newEquipment.totalQuantity} />
					</div>
					<div>
						<label class="label label-text" for="eq-ooo">Out of Order</label>
						<input id="eq-ooo" type="number" min="0" class="input input-bordered w-full" bind:value={newEquipment.outOfOrderQuantity} />
					</div>
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="label label-text" for="eq-serial">Serial Number</label>
						<input id="eq-serial" type="text" class="input input-bordered w-full" bind:value={newEquipment.serialNumber} />
					</div>
					<div>
						<label class="label label-text" for="eq-resource">Resource ID</label>
						<input id="eq-resource" type="text" class="input input-bordered w-full" bind:value={newEquipment.resourceId} />
					</div>
				</div>
				<div>
					<label class="label label-text" for="eq-notes">Notes</label>
					<textarea id="eq-notes" class="textarea textarea-bordered w-full" bind:value={newEquipment.notes}></textarea>
				</div>
				<div class="modal-action">
					<button type="button" class="btn btn-ghost" onclick={() => { showAddModal = false; resetNewEquipment(); }}>Cancel</button>
					<button type="submit" class="btn btn-primary">Add</button>
				</div>
			</form>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button onclick={() => { showAddModal = false; resetNewEquipment(); }}>close</button>
		</form>
	</dialog>
{/if}

<!-- Category Management Modal -->
{#if showCategoryModal}
	<dialog class="modal modal-open">
		<div class="modal-box max-w-lg">
			<h3 class="font-bold text-lg mb-4">Manage Categories</h3>

			<div class="overflow-x-auto mb-4">
				<table class="table table-sm">
					<thead>
						<tr>
							<th>Name</th>
							<th>Pricing Tier</th>
							<th>Order</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{#each data.categories as cat (cat.id)}
							<tr>
								<td>{cat.name}</td>
								<td><span class="badge badge-outline badge-sm">{cat.pricingTier}</span></td>
								<td>{cat.displayOrder}</td>
								<td class="text-right">
									<button
										class="btn btn-ghost btn-xs"
										onclick={() => (editingCategory = { id: cat.id, name: cat.name, displayOrder: cat.displayOrder, pricingTier: cat.pricingTier as PricingTier })}
									>Edit</button>
									<AsyncButton
										action={async () => {
											if (!window.confirm(`Delete "${cat.name}"? Category must have no equipment.`)) return;
											await removeCategory({ id: cat.id });
											window.location.reload();
										}}
										label="Delete"
										class="btn-ghost btn-xs text-error"
									/>
								</td>
							</tr>
						{:else}
							<tr><td colspan="4" class="text-center opacity-60">No categories</td></tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Add / Edit Category Form -->
			<form
				onsubmit={async (e) => {
					e.preventDefault();
					if (editingCategory?.id) {
						await editCategory({ id: editingCategory.id, name: editingCategory.name, displayOrder: editingCategory.displayOrder, pricingTier: editingCategory.pricingTier });
					} else if (editingCategory) {
						await addCategory({ name: editingCategory.name, displayOrder: editingCategory.displayOrder, pricingTier: editingCategory.pricingTier });
					}
					editingCategory = null;
					window.location.reload();
				}}
				class="space-y-3 border-t pt-4"
			>
				<h4 class="text-sm font-semibold">{editingCategory?.id ? 'Edit' : 'Add'} Category</h4>
				{#if !editingCategory}
					<button type="button" class="btn btn-sm btn-outline" onclick={() => (editingCategory = { id: '', name: '', displayOrder: 0, pricingTier: 'accessory' as PricingTier })}>
						+ New Category
					</button>
				{:else}
					<div class="grid grid-cols-3 gap-3">
						<div class="col-span-2">
							<label class="label label-text" for="cat-name">Name</label>
							<input id="cat-name" type="text" class="input input-bordered input-sm w-full" bind:value={editingCategory.name} required />
						</div>
						<div>
							<label class="label label-text" for="cat-order">Order</label>
							<input id="cat-order" type="number" min="0" class="input input-bordered input-sm w-full" bind:value={editingCategory.displayOrder} />
						</div>
					</div>
					<div>
						<label class="label label-text" for="cat-tier">Pricing Tier</label>
						<select id="cat-tier" class="select select-bordered select-sm w-full" bind:value={editingCategory.pricingTier}>
							{#each pricingTiers as t}
								<option value={t}>{t} ({t === 'major' ? '$5/day' : '$1/day'})</option>
							{/each}
						</select>
					</div>
					<div class="flex gap-2">
						<button type="button" class="btn btn-ghost btn-sm" onclick={() => (editingCategory = null)}>Cancel</button>
						<button type="submit" class="btn btn-primary btn-sm">{editingCategory.id ? 'Save' : 'Add'}</button>
					</div>
				{/if}
			</form>

			<div class="modal-action">
				<button class="btn btn-ghost" onclick={() => (showCategoryModal = false)}>Close</button>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button onclick={() => (showCategoryModal = false)}>close</button>
		</form>
	</dialog>
{/if}
