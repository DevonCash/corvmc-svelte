<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { getStaffArticle, getStaffCategories, updateArticle, deleteArticle } from '$lib/remote/help.remote';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import FormField from '$lib/components/shared/Form/FormField.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import MarkdownEditor from '$lib/components/help/MarkdownEditor.svelte';
	import Action from '$lib/components/shared/Action.svelte';
	import { IconTrash } from '@tabler/icons-svelte';

	let id = $derived(page.params.id!);
	let article = $derived(await getStaffArticle(id));
	let categories = $derived(await getStaffCategories());

	let contentValue = $state('');

	$effect(() => {
		if (article) contentValue = article.content;
	});


</script>

<PageHeader title="Edit Article" subtitle="Help" backHref="/staff/help">
	<Action
		action={deleteArticle}
		modalTitle="Confirm"
		successToast="Article deleted"
		onsuccess={() => goto('/staff/help')}
		class="btn-error btn-sm btn-outline"
	>
		{#snippet form({ close })}
			<input type="hidden" name="id" value={id} />
			<p class="py-4">Permanently delete "{article?.title}"?</p>
		{/snippet}
		<IconTrash size={16} /> Delete
	</Action>
</PageHeader>
<PageContent width="3xl">
	{#if article}
		<Form
			remote={updateArticle}
			successToast="Article updated"
		>
			<input type="hidden" name="id" value={article.id} />

			<div class="space-y-4">
				<div class="grid gap-4 sm:grid-cols-2">
					<FormField name="title" type="text" label="Title" value={article.title} />
					<FormField name="slug" type="text" label="Slug" value={article.slug} />
				</div>

				<div class="grid gap-4 sm:grid-cols-3">
					<FormField name="categoryId" type="select" label="Category" value={article.categoryId}
						options={categories.map((c) => ({ value: c.id, label: c.name }))} />
					<FormField name="minRole" type="select" label="Minimum Role" value={article.minRole}
						options={[
							{ value: 'member', label: 'Member' },
							{ value: 'staff', label: 'Staff' },
							{ value: 'admin', label: 'Admin' }
						]} />
					<FormField name="published" type="toggle" label="Status" value={article.published}
						checkboxLabel="Published" />
				</div>

				<FormField name="summary" type="text" label="Summary" value={article.summary ?? ''}
					placeholder="Brief description" />

				<FormField name="content" label="Content">
					<input type="hidden" name="content" value={contentValue} />
					<MarkdownEditor bind:value={contentValue} />
				</FormField>

				{#if article.source === 'static'}
					<div class="alert alert-info text-sm">
						This article is synced from a markdown file. Edits here will be overwritten on the next sync.
					</div>
				{/if}

				<div class="flex justify-end gap-2">
					<a href="/staff/help" class="btn btn-ghost">Cancel</a>
					<SubmitButton label="Save Changes" />
				</div>
			</div>
		</Form>
	{/if}
</PageContent>
