<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import Badge from '$lib/components/shared/Badge.svelte';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import { getBandLayout } from '$lib/remote/layout.remote';
	import { getBandPageEditor, saveBandPageConfig } from '$lib/remote/band-page-editor.remote';
	import { BAND_THEMES } from '$lib/server/db/schema/band-page';
	import { page } from '$app/state';

	let layout = $derived(await getBandLayout(page.params.slug!));
	let pageData = $derived(await getBandPageEditor(page.params.slug!));
	const band = $derived(layout.band);

	// Gate: premium only
	const isPremium = $derived(band.tier === 'premium');

	// Local state for editable fields
	let selectedTheme = $state(pageData.config?.theme ?? 'default');
	let customCss = $state(pageData.config?.customCss ?? '');
</script>

<PageHeader title="Page Editor" subtitle={band.name}>
	{#if isPremium && pageData.config}
		<Badge variant="success">Premium</Badge>
	{/if}
</PageHeader>
<PageContent width="2xl">
	{#if !isPremium}
		<EmptyState>
			<p class="text-lg font-medium">Premium Feature</p>
			<p class="mt-2 opacity-70">
				The page editor is available with a premium band subscription.
				Build a custom band page with drag-and-drop blocks, genre themes, and custom CSS.
			</p>
			<Button href="../subscription" class="btn-primary mt-4">Upgrade to Premium</Button>
		</EmptyState>
	{:else}
		<form
			{...saveBandPageConfig.enhance(async (form) => {
				try {
					if (await form.submit()) {
						toast.success('Page config saved');
						invalidateAll();
					}
				} catch {
					toast.error('Failed to save');
				}
			})}
			class="space-y-6"
		>
			<input {...saveBandPageConfig.fields.slug.as('hidden', band.slug)} />
			<input {...saveBandPageConfig.fields.theme.as('hidden', selectedTheme)} />
			<input {...saveBandPageConfig.fields.customCss.as('hidden', customCss)} />

			<!-- Theme selector -->
			<div class="card bg-base-100 shadow-sm">
				<div class="card-body">
					<h2 class="card-title text-lg">Theme</h2>
					<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
						{#each BAND_THEMES as theme}
							<button
								type="button"
								class="btn btn-sm capitalize {selectedTheme === theme ? 'btn-primary' : 'btn-outline'}"
								onclick={() => { selectedTheme = theme; }}
							>
								{theme}
							</button>
						{/each}
					</div>
				</div>
			</div>

			<!-- Blocks list -->
			<div class="card bg-base-100 shadow-sm">
				<div class="card-body">
					<div class="flex items-center justify-between">
						<h2 class="card-title text-lg">Blocks</h2>
						<button type="button" class="btn btn-sm btn-primary">Add Block</button>
					</div>

					{#if !pageData.config || pageData.config.blocks.length === 0}
						<p class="text-sm opacity-60 mt-4">
							No blocks configured yet. Add blocks to build your custom page.
							Your page will show a default layout until you add blocks.
						</p>
					{:else}
						<div class="mt-4 space-y-2">
							{#each pageData.config.blocks as block, i (block.id)}
								<div class="flex items-center gap-3 p-3 rounded-lg bg-base-200">
									<span class="text-sm font-mono opacity-40">{i + 1}</span>
									<span class="badge badge-sm capitalize">{block.type}</span>
									<span class="flex-1 text-sm opacity-60 truncate">
										{#if block.type === 'bio'}
											{block.content.slice(0, 50)}...
										{:else if block.type === 'embed'}
											{block.url}
										{:else if block.type === 'hero'}
											{block.headline ?? 'Hero image'}
										{:else}
											{block.type} block
										{/if}
									</span>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			<!-- Custom CSS -->
			<div class="card bg-base-100 shadow-sm">
				<div class="card-body">
					<h2 class="card-title text-lg">Custom CSS</h2>
					<p class="text-sm opacity-60">
						Add custom styles to your page. CSS is scoped to your band site container.
					</p>
					<textarea
						class="textarea textarea-bordered w-full font-mono text-sm mt-2"
						rows="8"
						placeholder={`.band-site-container {\n  /* your styles here */\n}`}
						value={customCss}
						oninput={(e) => { customCss = e.currentTarget.value; }}
					></textarea>
					<p class="text-xs opacity-40 mt-1">Max 50KB. External imports and scripts are stripped.</p>
				</div>
			</div>

			<!-- Save -->
			<div class="flex justify-between items-center">
				<a
					href="/?__band_subdomain={band.slug}"
					target="_blank"
					rel="noopener"
					class="link text-sm"
				>
					Preview your page &rarr;
				</a>
				<button class="btn btn-primary">Save Changes</button>
			</div>
		</form>

		<!-- EPK Editor (outside the main form) -->
		<div class="card bg-base-100 shadow-sm mt-6">
			<div class="card-body">
				<div class="flex items-center justify-between">
					<div>
						<h2 class="card-title text-lg">Electronic Press Kit</h2>
						<p class="text-sm opacity-60">
							Manage your EPK data — contacts, press quotes, achievements, and tech rider.
						</p>
					</div>
					<a href="page-editor/epk" class="btn btn-sm btn-outline">Edit EPK</a>
				</div>
			</div>
		</div>
	{/if}
</PageContent>
