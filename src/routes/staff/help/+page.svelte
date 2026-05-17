<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { getArticles, getCategories, deleteArticleCommand, createCategoryCommand, deleteCategoryCommand } from './data.remote';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import Column from '$lib/components/shared/Table/Column.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Action from '$lib/components/shared/Action.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import { IconPlus, IconTrash } from '@tabler/icons-svelte';
	import { formatDate } from '$lib/utils/format';

	let articles = $derived(await getArticles());
	let categories = $derived(await getCategories());

	let categoryMap = $derived(
		Object.fromEntries(categories.map((c) => [c.id, c.name]))
	);

	// Category creation state
	let newCatName = $state('');
	let newCatSlug = $state('');

	function slugFromName(name: string) {
		return name.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
	}

	async function handleCreateCategory() {
		if (!newCatName.trim()) return;
		await createCategoryCommand({
			name: newCatName.trim(),
			slug: newCatSlug.trim() || slugFromName(newCatName),
			sortOrder: categories.length
		});
		newCatName = '';
		newCatSlug = '';
		invalidateAll();
	}

	async function handleDeleteArticle(id: string) {
		await deleteArticleCommand({ id });
		invalidateAll();
	}

	async function handleDeleteCategory(id: string) {
		await deleteCategoryCommand({ id });
		invalidateAll();
	}
</script>

<PageHeader title="Help Articles">
	<a href="/staff/help/create" class="btn btn-primary btn-sm">
		<IconPlus size={16} /> New Article
	</a>
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
							<span class="badge badge-xs badge-ghost ml-1">{cat.minRole}</span>
						</div>
						<Action
							action={() => handleDeleteCategory(cat.id)}
							confirm={`Delete "${cat.name}" and all its articles?`}
						>
							<IconTrash size={14} />
						</Action>
					</div>
				{/each}
			</div>
			<div class="flex gap-2 mt-4 items-end">
				<div class="form-control">
					<label class="label"><span class="label-text text-xs">Name</span></label>
					<input type="text" class="input input-bordered input-sm w-40" bind:value={newCatName} placeholder="Category name" />
				</div>
				<div class="form-control">
					<label class="label"><span class="label-text text-xs">Slug</span></label>
					<input type="text" class="input input-bordered input-sm w-40" bind:value={newCatSlug} placeholder={slugFromName(newCatName) || 'auto'} />
				</div>
				<button class="btn btn-sm btn-primary" onclick={handleCreateCategory} disabled={!newCatName.trim()}>
					Add
				</button>
			</div>
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
