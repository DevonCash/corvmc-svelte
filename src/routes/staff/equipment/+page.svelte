<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import DataList from '$lib/components/shared/DataList.svelte';
	import Table from '$lib/components/shared/Table.svelte';
	import FilterBar from '$lib/components/shared/FilterBar.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Badge from '$lib/components/shared/Badge.svelte';
	import { rowLink } from '$lib/actions/row-link';
	import { resolve } from '$app/paths';
	import { Field } from '$lib/components/shared/Form';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import Modal from '$lib/components/shared/Modal.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import {
		addCategory,
		editCategory,
		getEquipmentCategories,
		getStaffEquipmentList
	} from '$lib/remote/equipment.remote';
	import { equipmentStatuses, pricingTiers, equipmentConditionBadge } from '$lib/config';
	import type { EquipmentCondition } from '$lib/server/db/schema/equipment';
	import type { PricingTier } from '$lib/server/db/schema/equipment';
	import { AddEquipmentAction, RemoveCategoryAction } from '$lib/components/shared/actions';
	import Button from '$lib/components/shared/Button.svelte';
	import { titleCase } from '$lib/utils/format';

	const { fields: editCategoryFields } = editCategory;

	// `searchText`, not `search`: FilterBar's always-visible slot is a snippet
	// named `search`, and a snippet shadows a same-named script binding.
	let searchText = $state('');
	let categoryId = $state('');
	let statusFilter = $state('');
	let page = $state(1);

	let searchDebounced = $state('');
	let searchTimer: ReturnType<typeof setTimeout>;
	function onSearchInput(e: Event) {
		searchText = (e.target as HTMLInputElement).value;
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			searchDebounced = searchText;
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

	const activeFilterCount = $derived(
		(searchDebounced ? 1 : 0) + (categoryId ? 1 : 0) + (statusFilter ? 1 : 0)
	);

	function clearFilters() {
		searchText = '';
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
		<Button class="btn-ghost btn-sm" onclick={() => (showCategoryModal = true)}>Categories</Button>
		<AddEquipmentAction {categories} />
	</div>
</PageHeader>
<PageContent>
	<FilterBar activeCount={activeFilterCount} onclear={clearFilters}>
		{#snippet search()}
			<input
				type="text"
				class="input input-bordered input-sm w-full"
				placeholder="Search name, serial, resource ID..."
				value={searchText}
				oninput={onSearchInput}
			/>
		{/snippet}
		<select
			class="select select-bordered select-sm"
			aria-label="Category"
			value={categoryId}
			onchange={(e) => {
				categoryId = (e.currentTarget as HTMLSelectElement).value;
				page = 1;
			}}
		>
			<option value="">All categories</option>
			{#each categories as c (c.id)}
				<option value={c.id}>{c.name}</option>
			{/each}
		</select>
		<select
			class="select select-bordered select-sm"
			aria-label="Status"
			value={statusFilter}
			onchange={(e) => {
				statusFilter = (e.currentTarget as HTMLSelectElement).value;
				page = 1;
			}}
		>
			<option value="">All statuses</option>
			{#each equipmentStatuses as s (s)}
				<option value={s}>{titleCase(s)}</option>
			{/each}
		</select>
	</FilterBar>

	<DataList {result} empty="No equipment found" onpage={(p) => (page = p)}>
		{#snippet children(equipment)}
			<Table>
				{#snippet head()}
					<th class="w-px"><span class="sr-only">Status</span></th>
					<th>Equipment</th>
					<th class="col-support">Condition</th>
					<th class="cell-num">Available</th>
					<th class="col-extra">Resource ID</th>
				{/snippet}

				{#each equipment as e (e.id)}
					{@const href = resolve(`/staff/equipment/${e.id}`)}
					<tr class="hover cursor-pointer" use:rowLink={href}>
						<td class="w-px"><StatusBadge status={e.status} /></td>
						<!-- Category was its own column; as the subline it costs no width. -->
						<td class="cell-primary">
							<a {href} class="block truncate font-medium hover:underline">{e.name}</a>
							<div class="truncate text-sm opacity-60">{e.category.name}</div>
						</td>
						<td class="col-support">
							<Badge
								size="sm"
								class={equipmentConditionBadge[e.condition as EquipmentCondition] ?? 'badge-ghost'}
							>
								{titleCase(e.condition)}
							</Badge>
						</td>
						<td class="cell-num">
							<span class:text-error={e.availableQuantity <= 0}>
								{e.availableQuantity} / {e.totalQuantity}
							</span>
						</td>
						<td class="col-extra">
							{#if e.resourceId}
								<span class="font-mono text-xs">{e.resourceId}</span>
							{:else}
								<span class="opacity-40">—</span>
							{/if}
						</td>
					</tr>
				{/each}
			</Table>
		{/snippet}
	</DataList>
</PageContent>

<Modal bind:open={showCategoryModal} title="Manage Categories" maxWidth="max-w-lg">
	<div class="mb-4">
		{#if categories.length === 0}
			<EmptyState description="No categories" />
		{:else}
			<Table>
				{#snippet head()}
					<th>Name</th>
					<th class="col-support">Pricing tier</th>
					<th class="col-support cell-num">Order</th>
					<th class="w-px"><span class="sr-only">Actions</span></th>
				{/snippet}
				{#each categories as cat (cat.id)}
					<tr>
						<td class="cell-primary truncate">{cat.name}</td>
						<td class="col-support"><Badge size="sm" variant="outline">{cat.pricingTier}</Badge></td
						>
						<td class="col-support cell-num">{cat.displayOrder}</td>
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
			</Table>
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
				remote={editingCategory.id ? (editCategory as any) : addCategory}
				successToast={editingCategory.id ? 'Category updated' : 'Category added'}
				onsuccess={refreshCategories}
				class="space-y-3"
			>
				{#if editingCategory.id}
					<input {...editCategoryFields.id.as('hidden', editingCategory.id)} />
				{/if}
				<div class="grid grid-cols-3 gap-3">
					<Field
						name="name"
						type="text"
						label="Name"
						class="col-span-2"
						value={editingCategory.name}
					/>
					<Field
						name="displayOrder"
						type="number"
						label="Order"
						value={editingCategory.displayOrder}
					/>
				</div>
				<Field
					name="pricingTier"
					type="select"
					label="Pricing Tier"
					value={editingCategory.pricingTier}
					options={pricingTiers.map((t) => ({
						value: t,
						label: `${t} (${t === 'major' ? '$5/day' : '$1/day'})`
					}))}
				/>
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
