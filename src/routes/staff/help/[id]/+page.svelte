<script lang="ts">
	import { page } from '$app/state';
	import { goto, invalidateAll } from '$app/navigation';
	import { getArticle, getCategories, updateArticleCommand, deleteArticleCommand } from '../data.remote';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import MarkdownEditor from '$lib/components/help/MarkdownEditor.svelte';
	import Action from '$lib/components/shared/Action.svelte';
	import { IconTrash } from '@tabler/icons-svelte';

	let id = $derived(page.params.id!);
	let article = $derived(await getArticle(id));
	let categories = $derived(await getCategories());

	let title = $state('');
	let slug = $state('');
	let summary = $state('');
	let content = $state('');
	let categoryId = $state('');
	let minRole = $state('member');
	let published = $state(false);
	let saving = $state(false);

	$effect(() => {
		if (article) {
			title = article.title;
			slug = article.slug;
			summary = article.summary ?? '';
			content = article.content;
			categoryId = article.categoryId;
			minRole = article.minRole;
			published = article.published;
		}
	});

	async function handleSave() {
		saving = true;
		try {
			await updateArticleCommand({
				id,
				categoryId,
				title: title.trim(),
				slug: slug.trim(),
				summary: summary.trim() || undefined,
				content,
				minRole,
				published
			});
			invalidateAll();
		} finally {
			saving = false;
		}
	}

	async function handleDelete() {
		await deleteArticleCommand({ id });
		goto('/staff/help');
	}
</script>

<PageHeader title="Edit Article" subtitle="Help" backHref="/staff/help">
	<Action
		action={handleDelete}
		confirm={`Permanently delete "${title}"?`}
	>
		<button class="btn btn-error btn-sm btn-outline">
			<IconTrash size={16} /> Delete
		</button>
	</Action>
</PageHeader>
<PageContent width="3xl">
	{#if article}
		<div class="space-y-4">
			<div class="grid gap-4 sm:grid-cols-2">
				<div class="form-control">
					<label class="label"><span class="label-text">Title</span></label>
					<input type="text" class="input input-bordered" bind:value={title} />
				</div>
				<div class="form-control">
					<label class="label"><span class="label-text">Slug</span></label>
					<input type="text" class="input input-bordered" bind:value={slug} />
				</div>
			</div>

			<div class="grid gap-4 sm:grid-cols-3">
				<div class="form-control">
					<label class="label"><span class="label-text">Category</span></label>
					<select class="select select-bordered" bind:value={categoryId}>
						{#each categories as cat}
							<option value={cat.id}>{cat.name}</option>
						{/each}
					</select>
				</div>
				<div class="form-control">
					<label class="label"><span class="label-text">Minimum Role</span></label>
					<select class="select select-bordered" bind:value={minRole}>
						<option value="member">Member</option>
						<option value="staff">Staff</option>
						<option value="admin">Admin</option>
					</select>
				</div>
				<div class="form-control">
					<label class="label"><span class="label-text">Status</span></label>
					<label class="label cursor-pointer justify-start gap-3">
						<input type="checkbox" class="toggle toggle-primary" bind:checked={published} />
						<span class="label-text">{published ? 'Published' : 'Draft'}</span>
					</label>
				</div>
			</div>

			<div class="form-control">
				<label class="label"><span class="label-text">Summary</span></label>
				<input type="text" class="input input-bordered" bind:value={summary} placeholder="Brief description" />
			</div>

			<div class="form-control">
				<label class="label"><span class="label-text">Content</span></label>
				<MarkdownEditor bind:value={content} />
			</div>

			{#if article.source === 'static'}
				<div class="alert alert-info text-sm">
					This article is synced from a markdown file. Edits here will be overwritten on the next sync.
				</div>
			{/if}

			<div class="flex justify-end gap-2">
				<a href="/staff/help" class="btn btn-ghost">Cancel</a>
				<button class="btn btn-primary" disabled={saving} onclick={handleSave}>
					{#if saving}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					Save Changes
				</button>
			</div>
		</div>
	{/if}
</PageContent>
