<script lang="ts">
	import { goto } from '$app/navigation';
	import { getCategories, createArticleCommand } from '../data.remote';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import MarkdownEditor from '$lib/components/help/MarkdownEditor.svelte';

	let categories = $derived(await getCategories());

	let title = $state('');
	let slug = $state('');
	let summary = $state('');
	let content = $state('');
	let categoryId = $state('');
	let minRole = $state('member');
	let published = $state(false);
	let saving = $state(false);

	function slugFromTitle(t: string) {
		return t.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
	}

	let autoSlug = $derived(slugFromTitle(title));

	async function handleSave() {
		if (!title.trim() || !content.trim() || !categoryId) return;
		saving = true;
		try {
			const result = await createArticleCommand({
				categoryId,
				title: title.trim(),
				slug: slug.trim() || autoSlug,
				summary: summary.trim() || undefined,
				content,
				minRole,
				published
			});
			goto(`/staff/help/${result.id}`);
		} finally {
			saving = false;
		}
	}
</script>

<PageHeader title="New Article" subtitle="Help" backHref="/staff/help" />
<PageContent width="3xl">
	<div class="space-y-4">
		<div class="grid gap-4 sm:grid-cols-2">
			<div class="form-control">
				<label class="label"><span class="label-text">Title</span></label>
				<input type="text" class="input input-bordered" bind:value={title} placeholder="Article title" />
			</div>
			<div class="form-control">
				<label class="label"><span class="label-text">Slug</span></label>
				<input type="text" class="input input-bordered" bind:value={slug} placeholder={autoSlug || 'auto-generated'} />
			</div>
		</div>

		<div class="grid gap-4 sm:grid-cols-3">
			<div class="form-control">
				<label class="label"><span class="label-text">Category</span></label>
				<select class="select select-bordered" bind:value={categoryId}>
					<option value="">Select category...</option>
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
			<input type="text" class="input input-bordered" bind:value={summary} placeholder="Brief description for listings" />
		</div>

		<div class="form-control">
			<label class="label"><span class="label-text">Content</span></label>
			<MarkdownEditor bind:value={content} />
		</div>

		<div class="flex justify-end gap-2">
			<a href="/staff/help" class="btn btn-ghost">Cancel</a>
			<button
				class="btn btn-primary"
				disabled={!title.trim() || !content.trim() || !categoryId || saving}
				onclick={handleSave}
			>
				{#if saving}
					<span class="loading loading-spinner loading-sm"></span>
				{/if}
				Create Article
			</button>
		</div>
	</div>
</PageContent>
