<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { getStaffArticles, getStaffCategories, createCategory, deleteCategory } from '$lib/remote/help.remote';
	const { fields: deleteFields } = deleteCategory;
	const { fields: createCatFields } = createCategory;
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import Column from '$lib/components/shared/Table/Column.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Action from '$lib/components/shared/Action.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import FormField from '$lib/components/shared/Form/FormField.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import { IconPlus, IconTrash } from '@tabler/icons-svelte';
	import Badge from '$lib/components/shared/Badge.svelte';

	let articles = $derived(await getStaffArticles());
	let categories = $derived(await getStaffCategories());

	let categoryMap = $derived(
		Object.fromEntries(categories.map((c) => [c.id, c.name]))
	);

	let catNameValue = $state('');

	function slugFromName(name: string) {
		return name.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
	}
</script>

<PageHeader title="Help Articles">
	<Button href="/staff/help/create" class="btn-sm">
		<IconPlus size={16} /> New Article
	</Button>
</PageHeader>
<PageContent>
	<!-- Categories section -->
	<details class="collapse collapse-arrow border border-base-300 bg-base-100 mb-6">
		<summary class="collapse-title font-medium text-sm">Manage Categories ({categories.length})</summary>
		<div class="collapse-content">
			<div class="space-y-2">
				{#each categories as cat}
					<div class="flex items-center justify-between gap-2 py-1">
						<div>
							<span class="font-medium text-sm">{cat.name}</span>
							<span class="text-xs opacity-50 ml-2">/{cat.slug}</span>
							<Badge variant="ghost" size="xs" class="ml-1">{cat.minRole}</Badge>
						</div>
						<Action
							action={deleteCategory}
							modalTitle="Confirm"
							successToast="Category deleted"
							onsuccess={() => invalidateAll()}
							class="btn-ghost btn-xs"
						>
							{#snippet form({ close })}
								<input {...deleteFields.id.as('hidden', cat.id)} />
								<p class="py-4">Delete "{cat.name}" and all its articles?</p>
							{/snippet}
							<IconTrash size={14} />
						</Action>
					</div>
				{/each}
			</div>
			<Form remote={createCategory} successToast="Category created" onsuccess={() => invalidateAll()}>
				<div class="flex gap-2 mt-4 items-end">
					<FormField name="name" label="Name">
						<input name="name" type="text" class="input input-bordered input-sm w-40"
							placeholder="Category name" bind:value={catNameValue} />
					</FormField>
					<FormField name="slug" label="Slug">
						<input name="slug" type="text" class="input input-bordered input-sm w-40"
							placeholder={slugFromName(catNameValue) || 'auto'} />
					</FormField>
					<input {...createCatFields.sortOrder.as('hidden', categories.length)} />
					<SubmitButton label="Add" class="btn-primary btn-sm" />
				</div>
			</Form>
		</div>
	</details>

	<!-- Articles table -->
	{#if articles.length === 0}
		<EmptyState message="No help articles yet. Create one to get started." />
	{:else}
		<DataTable data={articles} rowHref={(row) => `/staff/help/${row.id}`}>
			<Column key="title" header="Title" sortable />
			<Column key="categoryId" header="Category">
				{#snippet cell(value)}
					{categoryMap[value] ?? '—'}
				{/snippet}
			</Column>
			<Column key="published" header="Status">
				{#snippet cell(value)}
					<StatusBadge status={value ? 'published' : 'draft'} />
				{/snippet}
			</Column>
			<Column key="source" header="Source">
				{#snippet cell(value)}
					<span class="badge badge-xs {value === 'static' ? 'badge-info' : 'badge-ghost'}">{value}</span>
				{/snippet}
			</Column>
			<Column key="minRole" header="Role">
				{#snippet cell(value)}
					<span class="text-xs">{value}</span>
				{/snippet}
			</Column>
			<Column key="updatedAt" header="Updated" sortable type="date" />
		</DataTable>
	{/if}
</PageContent>
