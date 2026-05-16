<script lang="ts">
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import Column from '$lib/components/shared/Table/Column.svelte';
	import * as Filter from '$lib/components/shared/Table/Filter';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import FormField from '$lib/components/shared/Form/FormField.svelte';
	import { addEquipment, addCategory, editCategory, removeCategory } from './data.remote';
	import {
		equipmentConditions,
		equipmentStatuses,
		pricingTiers,
		type PricingTier
	} from '$lib/types/equipment';
	import Action from '$lib/components/shared/Action.svelte';
	import type { StaffEquipmentResponse } from '$lib/types/api';

	let { data }: { data: StaffEquipmentResponse } = $props();

	let showCategoryModal = $state(false);

	// Category management
	let editingCategory = $state<null | {
		id: string;
		name: string;
		displayOrder: number;
		pricingTier: PricingTier;
	}>(null);
</script>

<div class="space-y-6">
	<PageHeader title="Equipment">
		<div class="flex gap-2">
			<button class="btn btn-ghost btn-sm" onclick={() => (showCategoryModal = true)}>
				Categories
			</button>
			<Action
				action={addEquipment}
				label="Add Equipment"
				modalTitle="Add Equipment"
				class="btn-primary btn-sm"
				successToast="Equipment added"
				onsuccess={() => window.location.reload()}
			>
				{#snippet form({ close })}
					<FormField name="name" type="text" label="Name" />
					<FormField name="description" type="textarea" label="Description" />
					<div class="grid grid-cols-2 gap-3">
						<FormField name="categoryId" type="select" label="Category"
							options={data.categories.map((c) => ({ value: c.id, label: c.name }))} />
						<FormField name="condition" type="select" label="Condition"
							value="good"
							options={equipmentConditions.map((c) => ({ value: c, label: c }))} />
					</div>
					<div class="grid grid-cols-2 gap-3">
						<FormField name="totalQuantity" type="number" label="Total Quantity" value={1} />
						<FormField name="outOfOrderQuantity" type="number" label="Out of Order" value={0} />
					</div>
					<div class="grid grid-cols-2 gap-3">
						<FormField name="serialNumber" type="text" label="Serial Number" />
						<FormField name="resourceId" type="text" label="Resource ID" />
					</div>
					<FormField name="notes" type="textarea" label="Notes" />
				{/snippet}
			</Action>
		</div>
	</PageHeader>

	<DataTable data={data.equipment} rowHref={(e) => `/staff/equipment/${e.id}`} clearHref="/staff/equipment" empty="No equipment found">
		{#snippet toolbar()}
			<Filter.Search name="q" value={data.filters.search} placeholder="Search name, serial, resource ID..." class="w-64" />
			<Filter.Select name="category" value={data.filters.categoryId} placeholder="All categories"
				options={data.categories.map((c) => ({ value: c.id, label: c.name }))} />
			<Filter.Select name="status" value={data.filters.status} placeholder="All statuses"
				options={equipmentStatuses} />
		{/snippet}
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

<!-- Category Management Modal -->
{#if showCategoryModal}
	<dialog class="modal-open modal">
		<div class="modal-box max-w-lg">
			<h3 class="mb-4 text-lg font-bold">Manage Categories</h3>

			<div class="mb-4 overflow-x-auto">
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
										onclick={() =>
											(editingCategory = {
												id: cat.id,
												name: cat.name,
												displayOrder: cat.displayOrder,
												pricingTier: cat.pricingTier as PricingTier
											})}>Edit</button
									>
									<Action
										action={async () => {
											if (!window.confirm(`Delete "${cat.name}"? Category must have no equipment.`))
												return;
											await removeCategory({ id: cat.id });
											window.location.reload();
										}}
										label="Delete"
										class="text-error btn-ghost btn-xs"
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
						await editCategory({
							id: editingCategory.id,
							name: editingCategory.name,
							displayOrder: editingCategory.displayOrder,
							pricingTier: editingCategory.pricingTier
						});
					} else if (editingCategory) {
						await addCategory({
							name: editingCategory.name,
							displayOrder: editingCategory.displayOrder,
							pricingTier: editingCategory.pricingTier
						});
					}
					editingCategory = null;
					window.location.reload();
				}}
				class="space-y-3 border-t pt-4"
			>
				<h4 class="text-sm font-semibold">{editingCategory?.id ? 'Edit' : 'Add'} Category</h4>
				{#if !editingCategory}
					<button
						type="button"
						class="btn btn-outline btn-sm"
						onclick={() =>
							(editingCategory = {
								id: '',
								name: '',
								displayOrder: 0,
								pricingTier: 'accessory' as PricingTier
							})}
					>
						+ New Category
					</button>
				{:else}
					<div class="grid grid-cols-3 gap-3">
						<div class="col-span-2">
							<label class="label-text label" for="cat-name">Name</label>
							<input
								id="cat-name"
								type="text"
								class="input-bordered input input-sm w-full"
								bind:value={editingCategory.name}
								required
							/>
						</div>
						<div>
							<label class="label-text label" for="cat-order">Order</label>
							<input
								id="cat-order"
								type="number"
								min="0"
								class="input-bordered input input-sm w-full"
								bind:value={editingCategory.displayOrder}
							/>
						</div>
					</div>
					<div>
						<label class="label-text label" for="cat-tier">Pricing Tier</label>
						<select
							id="cat-tier"
							class="select-bordered select w-full select-sm"
							bind:value={editingCategory.pricingTier}
						>
							{#each pricingTiers as t}
								<option value={t}>{t} ({t === 'major' ? '$5/day' : '$1/day'})</option>
							{/each}
						</select>
					</div>
					<div class="flex gap-2">
						<button
							type="button"
							class="btn btn-ghost btn-sm"
							onclick={() => (editingCategory = null)}>Cancel</button
						>
						<button type="submit" class="btn btn-sm btn-primary"
							>{editingCategory.id ? 'Save' : 'Add'}</button
						>
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
