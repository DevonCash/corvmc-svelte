<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { EntityRef } from '$lib/types/entity';
	import EntityAvatar from '../directory/EntityAvatar.svelte';
	import StatusBadge from '../StatusBadge.svelte';
	import { entityKinds, entityGlyph, hasSubtype } from './registry';
	import { getEntityViewer } from './context';
	import { entityHref } from '$lib/utils/entity-href';

	/**
	 * One record as a list item: its name, its single closest qualifier, and
	 * optionally its avatar and status.
	 *
	 * Two shapes, because the app has two:
	 *
	 *  - `size="sm"` — the staff table **primary cell**. Fifty-three of these
	 *    were hand-written as `<a class="block truncate font-medium
	 *    hover:underline">` plus a muted subline.
	 *  - `size="md"` — the standalone list row with a 40px avatar, as used
	 *    beside a profile.
	 *
	 * It owns **one cell's content** and never the column set, the fetch, or the
	 * row element — `Table`, `DataList` and `use:rowLink` keep their boundaries
	 * exactly as they were. That is the line the deleted `DataTable` crossed.
	 */
	let {
		ref,
		size = 'sm',
		avatar = undefined,
		status = false,
		class: className = '',
		subtitle,
		meta
	}: {
		ref: EntityRef;
		size?: 'sm' | 'md';
		/** Defaults on for `md`, and only for types that have an avatar shape. */
		avatar?: boolean;
		status?: boolean;
		class?: string;
		/** Replaces `ref.subtitle` when the subline needs markup. */
		subtitle?: Snippet;
		/** Trailing content — counts, badges. `md` only. */
		meta?: Snippet;
	} = $props();

	const viewer = getEntityViewer();
	const href = $derived(entityHref(ref, viewer));
	const kind = $derived(entityKinds[ref.type]);
	const showAvatar = $derived(avatar ?? (size === 'md' && kind.shape !== 'none'));
	const hasSub = $derived(!!subtitle || !!ref.subtitle);

	// Marked variants only — a plain member, a self-booked reservation and a CMC
	// show all resolve to nothing here, because a glyph on every row marks
	// nothing. Which cases count is a registry fact, not a branch in this file.
	const glyph = $derived(hasSubtype(ref) ? entityGlyph(ref) : null);
</script>

{#snippet title()}
	{#if glyph}
		<span class="tooltip mr-1 align-middle" data-tip={glyph.label}>
			<glyph.icon size={14} />
		</span>
	{/if}{ref.title}
{/snippet}

{#if size === 'sm' && !showAvatar}
	<!--
		NO WRAPPER. `cell-primary` is `width:100%; max-width:0`, and `truncate`
		only resolves against that when the anchor is a *direct* block child of
		the cell. Wrapping these two in a <div> silently un-truncates every list
		in the app, and nothing throws — the same failure `Fact` renders bare
		<dt>/<dd> to avoid. The spec pins this.
	-->
	{#if href}
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- href comes from entityHref(), which calls resolve() internally; the rule cannot trace it through the function -->
		<a {href} class="block truncate font-medium hover:underline {className}">{@render title()}</a>
	{:else}
		<span class="block truncate font-medium {className}">{@render title()}</span>
	{/if}
	{#if hasSub}
		<div class="truncate text-muted">
			{#if subtitle}{@render subtitle()}{:else}{ref.subtitle}{/if}
		</div>
	{/if}
{:else}
	<div class="flex min-w-0 items-center gap-3 {className}">
		{#if status && ref.status}
			<StatusBadge status={ref.status} />
		{/if}
		{#if showAvatar}
			<EntityAvatar
				shape={kind.shape === 'round' ? 'round' : 'square'}
				name={ref.title}
				image={ref.image}
				size="avatar-sm"
				class={size === 'md' ? 'size-10 shrink-0' : 'size-6 shrink-0'}
			/>
		{/if}
		<div class="min-w-0 flex-1">
			{#if href}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- href comes from entityHref(), which calls resolve() internally; the rule cannot trace it through the function -->
				<a {href} class="block truncate font-medium hover:underline">{@render title()}</a>
			{:else}
				<span class="block truncate font-medium">{@render title()}</span>
			{/if}
			{#if hasSub}
				<div class="truncate text-muted">
					{#if subtitle}{@render subtitle()}{:else}{ref.subtitle}{/if}
				</div>
			{/if}
		</div>
		{#if meta}
			<div class="shrink-0">{@render meta()}</div>
		{/if}
	</div>
{/if}
