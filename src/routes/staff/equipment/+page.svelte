<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import Column from '$lib/components/shared/Table/Column.svelte';
	import SimpleTable from '$lib/components/shared/Table/SimpleTable.svelte';
	import * as Filter from '$lib/components/shared/Table/Filter';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Badge from '$lib/components/shared/Badge.svelte';
	import { Field } from '$lib/components/shared/Form';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import Modal from '$lib/components/shared/Modal.svelte';
	import { addCategory, editCategory } from '$lib/remote/equipment.remote';
	import { equipmentStatuses, pricingTiers } from '$lib/config';
	import type { PricingTier } from '$lib/server/db/schema/equipment';
	import { AddEquipmentAction, RemoveCategoryAction } from '$lib/components/shared/actions';
	import Button from '$lib/components/shared/Button.svelte';
	import type { PageProps } from './$types';

	const { fields: editCategoryFields } = editCategory;

	let { data }: PageProps = $props();

	function buildPageHref(page: number): string {
		const params = new URLSearchParams();
		if (data.filters.search) params.set('q', data.filters.search);
		if (data.filters.categoryId) params.set('category', data.filters.categoryId);
		if (data.filters.status) params.set('status', data.filters.status);
		params.set('page', String(page));
		return `/staff/equipment?${params.toString()}`;
	}

	let showCategoryModal = $state(false);

	let editingCategory = $state<null | {
		id: string;
		name: string;
		displayOrder: number;
		pricingTier: PricingTier;
	}>(null);
</script>

<PageHeader title="Equipment">
		<div class="flex gap-2">
			<Button class="btn-ghost btn-sm" onclick={() => (showCategoryModal = true)}>
				Categories
			</Button>
			<AddEquipmentAction categories={data.categories} />
		</div>
	</PageHeader>
<PageContent>
	<DataTable data={data.equipment} rowHref={(e) => `/staff/equipment/${e.id}`} clearHref="/staff/equipment" empty="No equipment found"
		pagination={{ page: data.pagination.page, totalPages: data.pagination.totalPages }} {buildPageHref}>
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
				<Badge variant="outline">{e.condition}</Badge>
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
</PageContent>

<Modal bind:open={showCategoryModal} title="Manage Categories" maxWidth="max-w-lg">
	<div class="mb-4">
		<SimpleTable data={data.categories} empty="No categories">
			<Column key="name" header="Name" />
			<Column key="pricingTier" header="Pricing Tier" type="badge" />
			<Column key="displayOrder" header="Order" />
			<Column key="id" header="" shrink class="text-right">
				{#snippet cell(_, cat)}
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
				{/snippet}
			</Column>
		</SimpleTable>
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
				onsuccess={() => {
					editingCategory = null;
					invalidateAll();
				}}
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
