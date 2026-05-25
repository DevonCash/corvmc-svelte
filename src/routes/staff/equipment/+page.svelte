<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import Pagination from '$lib/components/shared/Pagination.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Badge from '$lib/components/shared/Badge.svelte';
	import { Field } from '$lib/components/shared/Form';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import Modal from '$lib/components/shared/Modal.svelte';
	import { addCategory, editCategory, getEquipmentCategories, getStaffEquipmentList } from '$lib/remote/equipment.remote';
	import { equipmentStatuses, pricingTiers } from '$lib/config';
	import type { PricingTier } from '$lib/server/db/schema/equipment';
	import { AddEquipmentAction, RemoveCategoryAction } from '$lib/components/shared/actions';
	import Button from '$lib/components/shared/Button.svelte';

	const { fields: editCategoryFields } = editCategory;

	let search = $state('');
	let categoryId = $state('');
	let statusFilter = $state('');
	let page = $state(1);

	let searchDebounced = $state('');
	let searchTimer: ReturnType<typeof setTimeout>;
	function onSearchInput(e: Event) {
		search = (e.target as HTMLInputElement).value;
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			searchDebounced = search;
			page = 1;
		}, 300);
	}

	let filters = $derived({
		search: searchDebounced || undefined,
		categoryId: categoryId || undefined,
		status: statusFilter || undefined,
		page
	});

	let result = $derived(getStaffEquipmentList(filters));
	let categories = $derived(await getEquipmentCategories());

	let showCategoryModal = $state(false);
	let editingCategory = $state<null | {
		id: string;
		name: string;
		displayOrder: number;
		pricingTier: PricingTier;
	}>(null);

	function hasActiveFilters(): boolean {
		return !!(searchDebounced || categoryId || statusFilter);
	}

	function clearFilters() {
		search = '';
		searchDebounced = '';
		categoryId = '';
		statusFilter = '';
		page = 1;
	}

	function refreshCategories() {
		editingCategory = null;
		void getEquipmentCategories().refresh();
	}
</script>

<PageHeader title="Equipment">
	<div class="flex gap-2">
		<Button class="btn-ghost btn-sm" onclick={() => (showCategoryModal = true)}>
			Categories
		</Button>
		<AddEquipmentAction categories={categories} />
	</div>
</PageHeader>
<PageContent>
	<div class="flex flex-wrap items-end gap-2 mb-4">
		<input
			type="text"
			class="input input-bordered input-sm w-64"
			placeholder="Search name, serial, resource ID..."
			value={search}
			oninput={onSearchInput}
		/>
		<select class="select select-bordered select-sm" value={categoryId} onchange={(e) => { categoryId = (e.currentTarget as HTMLSelectElement).value; page = 1; }}>
			<option value="">All categories</option>
			{#each categories as c}
				<option value={c.id}>{c.name}</option>
			{/each}
		</select>
		<select class="select select-bordered select-sm" value={statusFilter} onchange={(e) => { statusFilter = (e.currentTarget as HTMLSelectElement).value; page = 1; }}>
			<option value="">All statuses</option>
			{#each equipmentStatuses as s}
				<option value={s}>{s}</option>
			{/each}
		</select>
		{#if hasActiveFilters()}
			<button class="btn btn-ghost btn-sm" onclick={clearFilters}>Clear</button>
		{/if}
	</div>

	{#await result}
		<div class="flex justify-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:then { rows: equipment, pagination }}
		{#if equipment.length === 0}
			<p class="text-center opacity-60 py-8">No equipment found</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="table">
					<thead>
						<tr>
							<th>Name</th>
							<th>Category</th>
							<th class="w-px">Status</th>
							<th class="w-px">Condition</th>
							<th class="w-px">Available</th>
							<th class="w-px">Resource ID</th>
						</tr>
					</thead>
					<tbody>
						{#each equipment as e (e.id)}
							<tr class="hover cursor-pointer" onclick={() => window.location.href = `/staff/equipment/${e.id}`}>
								<td>{e.name}</td>
								<td>{e.category.name}</td>
								<td class="w-px"><StatusBadge status={e.status} /></td>
								<td class="w-px"><Badge variant="outline">{e.condition}</Badge></td>
								<td class="w-px">
									<span class:text-error={e.availableQuantity <= 0}>
										{e.availableQuantity} / {e.totalQuantity}
									</span>
								</td>
								<td class="w-px">
									{#if e.resourceId}
										<span class="font-mono text-xs">{e.resourceId}</span>
									{:else}
										<span class="opacity-40">—</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<Pagination page={pagination.page} totalPages={pagination.totalPages} onpage={(p) => page = p} />
		{/if}
	{/await}
</PageContent>

<Modal bind:open={showCategoryModal} title="Manage Categories" maxWidth="max-w-lg">
	<div class="mb-4">
		{#if categories.length === 0}
			<p class="text-center opacity-60 py-4">No categories</p>
		{:else}
			<table class="table">
				<thead>
					<tr>
						<th>Name</th>
						<th>Pricing Tier</th>
						<th>Order</th>
						<th class="w-px text-right"></th>
					</tr>
				</thead>
				<tbody>
					{#each categories as cat (cat.id)}
						<tr>
							<td>{cat.name}</td>
							<td><Badge variant="outline">{cat.pricingTier}</Badge></td>
							<td>{cat.displayOrder}</td>
							<td class="w-px text-right">
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
								<RemoveCategoryAction categoryId={cat.id} name={cat.name} />
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>

	<div class="space-y-3 border-t pt-4">
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
			<Form
				remote={editingCategory.id ? editCategory as any : addCategory}
				successToast={editingCategory.id ? 'Category updated' : 'Category added'}
				onsuccess={refreshCategories}
				class="space-y-3"
			>
				{#if editingCategory.id}
					<input {...editCategoryFields.id.as('hidden', editingCategory.id)} />
				{/if}
				<div class="grid grid-cols-3 gap-3">
					<Field name="name" type="text" label="Name" class="col-span-2" value={editingCategory.name} />
					<Field name="displayOrder" type="number" label="Order" value={editingCategory.displayOrder} />
				</div>
				<Field name="pricingTier" type="select" label="Pricing Tier"
					value={editingCategory.pricingTier}
					options={pricingTiers.map((t) => ({ value: t, label: `${t} (${t === 'major' ? '$5/day' : '$1/day'})` }))} />
				<div class="flex gap-2">
					<button
						type="button"
						class="btn btn-ghost btn-sm"
						onclick={() => (editingCategory = null)}>Cancel</button
					>
					<SubmitButton label={editingCategory.id ? 'Save' : 'Add'} class="btn-sm btn-primary" />
				</div>
			</Form>
		{/if}
	</div>
</Modal>
