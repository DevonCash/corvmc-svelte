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
	import { BAND_THEMES, type Block } from '$lib/types/band-page';
	import { page } from '$app/state';

	let layout = $derived(await getBandLayout(page.params.slug!));
	let pageData = $derived(await getBandPageEditor(page.params.slug!));
	const band = $derived(layout.band);

	// Gate: premium only
	const isPremium = $derived(band.tier === 'premium');

	// Local state for editable fields — initialized from server data
	const initialConfig = $derived(pageData.config);
	let selectedTheme = $state(initialConfig?.theme ?? 'default');
	let customCss = $state(initialConfig?.customCss ?? '');
	let blocks = $state<Block[]>(structuredClone(initialConfig?.blocks ?? []));

	// Block type picker
	let showBlockPicker = $state(false);

	const BLOCK_TYPES: Array<{ type: Block['type']; label: string; description: string }> = [
		{ type: 'hero', label: 'Hero', description: 'Full-width hero image with headline' },
		{ type: 'bio', label: 'Bio', description: 'Rich text bio section' },
		{ type: 'links', label: 'Links', description: 'Social and music links' },
		{ type: 'members', label: 'Members', description: 'Band member roster' },
		{ type: 'events', label: 'Events', description: 'Upcoming shows' },
		{ type: 'gallery', label: 'Gallery', description: 'Photo gallery grid' },
		{ type: 'embed', label: 'Embed', description: 'YouTube, Spotify, SoundCloud embed' },
		{ type: 'press', label: 'Press', description: 'Press quotes from EPK' },
		{ type: 'achievements', label: 'Achievements', description: 'Highlights from EPK' },
		{ type: 'contact', label: 'Contact', description: 'Booking/management contacts from EPK' },
		{
			type: 'tech_rider',
			label: 'Tech Rider',
			description: 'Stage plot and backline requirements'
		},
		{ type: 'merch', label: 'Merch', description: 'Merchandise links' },
		{ type: 'spacer', label: 'Spacer', description: 'Vertical spacing between blocks' },
		{ type: 'custom_html', label: 'Custom HTML', description: 'Custom HTML content (sanitized)' }
	];

	function addBlock(type: Block['type']) {
		const id = crypto.randomUUID();
		let newBlock: Block;

		switch (type) {
			case 'hero':
				newBlock = { id, type: 'hero', imageKey: '' };
				break;
			case 'bio':
				newBlock = { id, type: 'bio', content: '' };
				break;
			case 'links':
				newBlock = { id, type: 'links', style: 'buttons' };
				break;
			case 'members':
				newBlock = { id, type: 'members', showPositions: true };
				break;
			case 'events':
				newBlock = { id, type: 'events', limit: 5 };
				break;
			case 'gallery':
				newBlock = { id, type: 'gallery', imageKeys: [], downloadable: false };
				break;
			case 'embed':
				newBlock = { id, type: 'embed', platform: '', url: '' };
				break;
			case 'press':
				newBlock = { id, type: 'press' };
				break;
			case 'achievements':
				newBlock = { id, type: 'achievements' };
				break;
			case 'contact':
				newBlock = { id, type: 'contact' };
				break;
			case 'tech_rider':
				newBlock = { id, type: 'tech_rider' };
				break;
			case 'merch':
				newBlock = { id, type: 'merch', items: [] };
				break;
			case 'spacer':
				newBlock = { id, type: 'spacer', height: 'md' };
				break;
			case 'custom_html':
				newBlock = { id, type: 'custom_html', content: '' };
				break;
			default:
				return;
		}

		blocks = [...blocks, newBlock];
		showBlockPicker = false;
	}

	function removeBlock(index: number) {
		blocks = blocks.filter((_, i) => i !== index);
	}

	function moveBlock(index: number, direction: 'up' | 'down') {
		const newBlocks = [...blocks];
		const target = direction === 'up' ? index - 1 : index + 1;
		if (target < 0 || target >= newBlocks.length) return;
		[newBlocks[index], newBlocks[target]] = [newBlocks[target], newBlocks[index]];
		blocks = newBlocks;
	}

	// Editing state
	let editingBlockId = $state<string | null>(null);

	// Block label helper
	function blockLabel(block: Block): string {
		switch (block.type) {
			case 'bio':
				return block.content.slice(0, 40) || 'Empty bio';
			case 'embed':
				return block.url || 'No URL set';
			case 'hero':
				return block.headline ?? 'Hero image';
			case 'spacer':
				return `${block.height} spacer`;
			case 'custom_html':
				return block.content.slice(0, 40) || 'Empty HTML';
			default:
				return `${block.type} block`;
		}
	}
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
				The page editor is available with a premium band subscription. Build a custom band page with
				drag-and-drop blocks, genre themes, and custom CSS.
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
			<input {...saveBandPageConfig.fields.blocks.as('hidden', JSON.stringify(blocks))} />

			<!-- Theme selector -->
			<div class="card bg-base-100 shadow-sm">
				<div class="card-body">
					<h2 class="card-title text-lg">Theme</h2>
					<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
						{#each BAND_THEMES as theme}
							<button
								type="button"
								class="btn btn-sm capitalize {selectedTheme === theme
									? 'btn-primary'
									: 'btn-outline'}"
								onclick={() => {
									selectedTheme = theme;
								}}
							>
								{theme}
							</button>
						{/each}
					</div>
				</div>
			</div>

			<!-- Blocks editor -->
			<div class="card bg-base-100 shadow-sm">
				<div class="card-body">
					<div class="flex items-center justify-between">
						<h2 class="card-title text-lg">Blocks</h2>
						<button
							type="button"
							class="btn btn-sm btn-primary"
							onclick={() => {
								showBlockPicker = !showBlockPicker;
							}}
						>
							{showBlockPicker ? 'Cancel' : 'Add Block'}
						</button>
					</div>

					<!-- Block type picker -->
					{#if showBlockPicker}
						<div class="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4 p-4 bg-base-200 rounded-lg">
							{#each BLOCK_TYPES as bt}
								<button
									type="button"
									class="btn btn-sm btn-ghost justify-start text-left h-auto py-2"
									onclick={() => addBlock(bt.type)}
								>
									<div>
										<p class="font-medium text-sm">{bt.label}</p>
										<p class="text-xs opacity-60">{bt.description}</p>
									</div>
								</button>
							{/each}
						</div>
					{/if}

					{#if blocks.length === 0}
						<p class="text-sm opacity-60 mt-4">
							No blocks configured yet. Add blocks to build your custom page. Your page will show a
							default layout until you add blocks.
						</p>
					{:else}
						<div class="mt-4 space-y-2">
							{#each blocks as block, i (block.id)}
								<div class="bg-base-200 rounded-lg overflow-hidden">
									<!-- Block header row -->
									<div class="flex items-center gap-2 p-3">
										<span class="text-sm font-mono opacity-40">{i + 1}</span>
										<span class="badge badge-sm capitalize">{block.type}</span>
										<span class="flex-1 text-sm opacity-60 truncate">{blockLabel(block)}</span>
										<div class="flex items-center gap-1">
											<button
												type="button"
												class="btn btn-xs btn-ghost"
												onclick={() => moveBlock(i, 'up')}
												disabled={i === 0}>&uarr;</button
											>
											<button
												type="button"
												class="btn btn-xs btn-ghost"
												onclick={() => moveBlock(i, 'down')}
												disabled={i === blocks.length - 1}>&darr;</button
											>
											<button
												type="button"
												class="btn btn-xs btn-ghost"
												onclick={() => {
													editingBlockId = editingBlockId === block.id ? null : block.id;
												}}
											>
												{editingBlockId === block.id ? 'Close' : 'Edit'}
											</button>
											<button
												type="button"
												class="btn btn-xs btn-ghost text-error"
												onclick={() => removeBlock(i)}>&times;</button
											>
										</div>
									</div>

									<!-- Block configuration panel -->
									{#if editingBlockId === block.id}
										<div class="px-3 pb-3 border-t border-base-300 pt-3 space-y-3">
											{#if block.type === 'hero'}
												<label class="form-control">
													<span class="label-text text-xs">Image Key (R2 path or URL)</span>
													<input
														type="text"
														class="input input-bordered input-sm w-full"
														value={block.imageKey}
														oninput={(e) => {
															block.imageKey = e.currentTarget.value;
														}}
													/>
												</label>
												<label class="form-control">
													<span class="label-text text-xs">Headline</span>
													<input
														type="text"
														class="input input-bordered input-sm w-full"
														value={block.headline ?? ''}
														oninput={(e) => {
															block.headline = e.currentTarget.value || undefined;
														}}
													/>
												</label>
												<label class="form-control">
													<span class="label-text text-xs">Subtitle</span>
													<input
														type="text"
														class="input input-bordered input-sm w-full"
														value={block.subtitle ?? ''}
														oninput={(e) => {
															block.subtitle = e.currentTarget.value || undefined;
														}}
													/>
												</label>
											{:else if block.type === 'bio'}
												<label class="form-control">
													<span class="label-text text-xs">Content (HTML/Markdown)</span>
													<textarea
														class="textarea textarea-bordered w-full text-sm"
														rows="5"
														value={block.content}
														oninput={(e) => {
															block.content = e.currentTarget.value;
														}}
													></textarea>
												</label>
											{:else if block.type === 'links'}
												<label class="form-control">
													<span class="label-text text-xs">Style</span>
													<select
														class="select select-bordered select-sm w-full"
														value={block.style}
														onchange={(e) => {
															block.style = e.currentTarget.value as 'buttons' | 'icons' | 'list';
														}}
													>
														<option value="buttons">Buttons</option>
														<option value="icons">Icons</option>
														<option value="list">List</option>
													</select>
												</label>
											{:else if block.type === 'members'}
												<label class="flex items-center gap-2">
													<input
														type="checkbox"
														class="checkbox checkbox-sm"
														checked={block.showPositions}
														onchange={(e) => {
															block.showPositions = e.currentTarget.checked;
														}}
													/>
													<span class="text-sm">Show member positions</span>
												</label>
											{:else if block.type === 'events'}
												<label class="form-control">
													<span class="label-text text-xs">Max events to show</span>
													<input
														type="number"
														class="input input-bordered input-sm w-24"
														min="1"
														max="20"
														value={block.limit ?? 5}
														oninput={(e) => {
															block.limit = parseInt(e.currentTarget.value) || 5;
														}}
													/>
												</label>
											{:else if block.type === 'gallery'}
												<label class="flex items-center gap-2">
													<input
														type="checkbox"
														class="checkbox checkbox-sm"
														checked={block.downloadable ?? false}
														onchange={(e) => {
															block.downloadable = e.currentTarget.checked;
														}}
													/>
													<span class="text-sm">Allow downloads (press-quality)</span>
												</label>
												<p class="text-xs opacity-60">
													Gallery images are pulled from your uploaded media. Use the media section
													below to upload images.
												</p>
											{:else if block.type === 'embed'}
												<label class="form-control">
													<span class="label-text text-xs">Platform</span>
													<input
														type="text"
														class="input input-bordered input-sm w-full"
														placeholder="spotify, youtube, soundcloud"
														value={block.platform}
														oninput={(e) => {
															block.platform = e.currentTarget.value;
														}}
													/>
												</label>
												<label class="form-control">
													<span class="label-text text-xs">URL</span>
													<input
														type="url"
														class="input input-bordered input-sm w-full"
														placeholder="https://open.spotify.com/track/..."
														value={block.url}
														oninput={(e) => {
															block.url = e.currentTarget.value;
														}}
													/>
												</label>
											{:else if block.type === 'spacer'}
												<label class="form-control">
													<span class="label-text text-xs">Height</span>
													<select
														class="select select-bordered select-sm w-full"
														value={block.height}
														onchange={(e) => {
															block.height = e.currentTarget.value as 'sm' | 'md' | 'lg';
														}}
													>
														<option value="sm">Small</option>
														<option value="md">Medium</option>
														<option value="lg">Large</option>
													</select>
												</label>
											{:else if block.type === 'custom_html'}
												<label class="form-control">
													<span class="label-text text-xs">HTML Content (sanitized on save)</span>
													<textarea
														class="textarea textarea-bordered w-full font-mono text-sm"
														rows="6"
														value={block.content}
														oninput={(e) => {
															block.content = e.currentTarget.value;
														}}
													></textarea>
												</label>
											{:else if block.type === 'press' || block.type === 'achievements' || block.type === 'contact' || block.type === 'tech_rider'}
												<p class="text-sm opacity-60">
													This block renders data from your EPK.
													<a href="page-editor/epk" class="link">Edit EPK data &rarr;</a>
												</p>
											{:else if block.type === 'merch'}
												<p class="text-xs opacity-60 mb-2">
													Add merchandise items with links to your store.
												</p>
												{#each block.items as item, mi}
													<div class="flex gap-2 items-start">
														<input
															type="text"
															class="input input-bordered input-sm flex-1"
															placeholder="Title"
															value={item.title}
															oninput={(e) => {
																item.title = e.currentTarget.value;
															}}
														/>
														<input
															type="url"
															class="input input-bordered input-sm flex-1"
															placeholder="URL"
															value={item.url}
															oninput={(e) => {
																item.url = e.currentTarget.value;
															}}
														/>
														<input
															type="text"
															class="input input-bordered input-sm w-20"
															placeholder="$25"
															value={item.price ?? ''}
															oninput={(e) => {
																item.price = e.currentTarget.value || undefined;
															}}
														/>
														<button
															type="button"
															class="btn btn-xs btn-ghost text-error"
															onclick={() => {
																block.items = block.items.filter((_, j) => j !== mi);
															}}>&times;</button
														>
													</div>
												{/each}
												<button
													type="button"
													class="btn btn-xs btn-ghost mt-1"
													onclick={() => {
														block.items = [...block.items, { title: '', url: '' }];
													}}>+ Add item</button
												>
											{/if}

											<!-- CSS class (all blocks) -->
											<label class="form-control">
												<span class="label-text text-xs">CSS Class (optional)</span>
												<input
													type="text"
													class="input input-bordered input-sm w-full"
													placeholder="custom-class"
													value={block.cssClass ?? ''}
													oninput={(e) => {
														(block as any).cssClass = e.currentTarget.value || undefined;
													}}
												/>
											</label>
										</div>
									{/if}
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
						oninput={(e) => {
							customCss = e.currentTarget.value;
						}}
					></textarea>
					<p class="text-xs opacity-40 mt-1">
						Max 50KB. External imports and scripts are stripped.
					</p>
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

		<!-- Media upload section -->
		<div class="card bg-base-100 shadow-sm mt-6">
			<div class="card-body">
				<h2 class="card-title text-lg">Media</h2>
				<p class="text-sm opacity-60">
					Upload images for your gallery, hero sections, and tech rider. Supported formats: JPEG,
					PNG, WebP, GIF. Max 10MB per file.
				</p>
				<div class="mt-4 grid grid-cols-2 gap-4">
					<div>
						<label class="form-control">
							<span class="label-text text-xs font-medium">Gallery Images</span>
							<input
								type="file"
								class="file-input file-input-bordered file-input-sm w-full mt-1"
								accept="image/*"
								multiple
								onchange={async (e) => {
									const files = e.currentTarget.files;
									if (!files?.length) return;
									const formData = new FormData();
									formData.set('type', 'image');
									for (const f of files) formData.append('file', f);
									const res = await fetch(`/api/bands/${band.id}/media`, {
										method: 'POST',
										body: formData
									});
									if (res.ok) {
										toast.success(`Uploaded ${files.length} image(s)`);
										invalidateAll();
									} else {
										const err = (await res.json()) as { message?: string };
										toast.error(err.message || 'Upload failed');
									}
									e.currentTarget.value = '';
								}}
							/>
						</label>
					</div>
					<div>
						<label class="form-control">
							<span class="label-text text-xs font-medium">Hero Image</span>
							<input
								type="file"
								class="file-input file-input-bordered file-input-sm w-full mt-1"
								accept="image/*"
								onchange={async (e) => {
									const file = e.currentTarget.files?.[0];
									if (!file) return;
									const formData = new FormData();
									formData.set('type', 'hero');
									formData.append('file', file);
									const res = await fetch(`/api/bands/${band.id}/media`, {
										method: 'POST',
										body: formData
									});
									if (res.ok) {
										toast.success('Hero image uploaded');
										invalidateAll();
									} else {
										const err = (await res.json()) as { message?: string };
										toast.error(err.message || 'Upload failed');
									}
									e.currentTarget.value = '';
								}}
							/>
						</label>
					</div>
					<div>
						<label class="form-control">
							<span class="label-text text-xs font-medium">Stage Plot</span>
							<input
								type="file"
								class="file-input file-input-bordered file-input-sm w-full mt-1"
								accept="image/*"
								onchange={async (e) => {
									const file = e.currentTarget.files?.[0];
									if (!file) return;
									const formData = new FormData();
									formData.set('type', 'stage_plot');
									formData.append('file', file);
									const res = await fetch(`/api/bands/${band.id}/media`, {
										method: 'POST',
										body: formData
									});
									if (res.ok) {
										toast.success('Stage plot uploaded');
										invalidateAll();
									} else {
										const err = (await res.json()) as { message?: string };
										toast.error(err.message || 'Upload failed');
									}
									e.currentTarget.value = '';
								}}
							/>
						</label>
					</div>
					<div>
						<label class="form-control">
							<span class="label-text text-xs font-medium">Tech Rider (PDF/Image)</span>
							<input
								type="file"
								class="file-input file-input-bordered file-input-sm w-full mt-1"
								accept="image/*,.pdf"
								onchange={async (e) => {
									const file = e.currentTarget.files?.[0];
									if (!file) return;
									const formData = new FormData();
									formData.set('type', 'rider');
									formData.append('file', file);
									const res = await fetch(`/api/bands/${band.id}/media`, {
										method: 'POST',
										body: formData
									});
									if (res.ok) {
										toast.success('Tech rider uploaded');
										invalidateAll();
									} else {
										const err = (await res.json()) as { message?: string };
										toast.error(err.message || 'Upload failed');
									}
									e.currentTarget.value = '';
								}}
							/>
						</label>
					</div>
				</div>
			</div>
		</div>

		<!-- EPK Editor link -->
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
