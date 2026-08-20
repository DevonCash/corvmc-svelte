<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { EntityRef } from '$lib/types/entity';
	import EntityAvatar from '../directory/EntityAvatar.svelte';
	import StatusBadge from '../StatusBadge.svelte';
	import { entityKinds, entityGlyph, hasSubtype, isNoteworthyStatus } from './registry';
	import { getEntityViewer } from './context';
	import { entityHref } from '$lib/utils/entity-href';

	/**
	 * One record's identity: its glyph or avatar, its name, the qualifiers that
	 * hold whoever is looking, and a trailing slot.
	 *
	 * The same object at three scales, which is why it is not called a row:
	 *
	 *  - `sm` — the staff table **primary cell**. Fifty-three of these were
	 *    hand-written as `<a class="block truncate font-medium hover:underline">`
	 *    plus a muted subline.
	 *  - `md` — a standalone list row with a 40px avatar.
	 *  - `lg` — the strip at the top of a record's own detail page, below
	 *    `PageHeader` and above any `TabBar`.
	 *
	 * `lg` was a separate `EntityHeader` component until it became clear the two
	 * were one thing drawn twice — and that two copies meant two places for the
	 * avatar-shape convention, the subtype glyph and the status rule to drift
	 * apart.
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
		email,
		phone,
		link = size !== 'lg',
		class: className = '',
		qualifiers,
		subtitle,
		meta
	}: {
		ref: EntityRef;
		size?: 'sm' | 'md' | 'lg';
		/** Defaults on for `md`/`lg`, and only for types that have an avatar shape. */
		avatar?: boolean;
		status?: boolean;
		/**
		 * Contact affordances, used as the subline in place of `ref.subtitle`. A
		 * detail strip wants to be actionable where a list row wants to be read.
		 */
		email?: string | null;
		phone?: string | null;
		/**
		 * Defaults off at `lg`: that size is the strip on a record's own page, and
		 * linking a record to the page you are already reading is a dead end. Pass
		 * it explicitly for a prominent list item that should still navigate.
		 */
		link?: boolean;
		class?: string;
		/** Extra inline facts beside the name — a member number, a tier. */
		qualifiers?: Snippet;
		/** Replaces `ref.subtitle` when the subline needs markup. */
		subtitle?: Snippet;
		/** Trailing content — counts, badges, actions. Block modes only. */
		meta?: Snippet;
	} = $props();

	const viewer = getEntityViewer();
	const href = $derived(link ? entityHref(ref, viewer) : null);
	const kind = $derived(entityKinds[ref.type]);
	const showAvatar = $derived(avatar ?? (size !== 'sm' && kind.shape !== 'none'));
	const hasContact = $derived(!!email || !!phone);
	const hasSub = $derived(hasContact || !!subtitle || !!ref.subtitle);
	const notableStatus = $derived(status && isNoteworthyStatus(ref.status));

	const avatarSize = $derived(size === 'lg' ? 'size-16' : size === 'md' ? 'size-10' : 'size-6');
	const titleSize = $derived(size === 'lg' ? 'text-lg' : '');

	// Marked variants only — a plain member, a self-booked reservation and a CMC
	// show all resolve to nothing here, because a glyph on every row marks
	// nothing. Which cases count is a registry fact, not a branch in this file.
	const glyph = $derived(hasSubtype(ref) ? entityGlyph(ref) : null);
</script>

{#snippet titleLine()}
	{#if glyph}
		<!--
			`align-middle` alone sits the glyph ~2px low: it aligns to the baseline
			plus half an x-height, not to the middle of the line. One line tall,
			topped to the line box, centring its contents puts the glyph's centre on
			the line's centre exactly — and keeps it inline, so the anchor stays
			`block truncate` and the cell-primary contract holds.
		-->
		<span class="tooltip mr-1 inline-flex h-[1lh] items-center align-top" data-tip={glyph.label}>
			<glyph.icon size={14} />
		</span>
	{/if}{ref.title}
{/snippet}

{#snippet titleRow()}
	<div class="flex flex-wrap items-baseline gap-2">
		{#if href}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- href comes from entityHref(), which calls resolve() internally; the rule cannot trace it through the function -->
			<a {href} class="min-w-0 truncate font-medium hover:underline {titleSize}"
				>{@render titleLine()}</a
			>
		{:else}
			<span class="min-w-0 truncate font-medium {titleSize}">{@render titleLine()}</span>
		{/if}
		{#if ref.type === 'member' && ref.pronouns}
			<!-- Narrowing the union to read a field only one arm has, which is not
			     the same as branching on type to decide *behaviour* — that belongs in
			     the registry. Pronouns are a fact about this record, and only members
			     have them. -->
			<span class="text-muted">{ref.pronouns}</span>
		{/if}
		{#if qualifiers}{@render qualifiers()}{/if}
		{#if size === 'lg' && notableStatus && ref.status}
			<!-- A header has room for the word, and there is exactly one record on
			     the page to say it about. Rows get the glyph. -->
			<StatusBadge status={ref.status} label />
		{/if}
	</div>
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
		<a {href} class="block truncate font-medium hover:underline {className}"
			>{@render titleLine()}</a
		>
	{:else}
		<span class="block truncate font-medium {className}">{@render titleLine()}</span>
	{/if}
	{#if hasSub}
		<div class="truncate text-muted">
			{#if subtitle}{@render subtitle()}{:else}{ref.subtitle}{/if}
		</div>
	{/if}
{:else}
	<div class="flex min-w-0 items-center {size === 'lg' ? 'gap-4' : 'gap-3'} {className}">
		{#if size !== 'lg' && notableStatus && ref.status}
			<StatusBadge status={ref.status} />
		{/if}
		{#if showAvatar}
			<EntityAvatar
				shape={kind.shape === 'round' ? 'round' : 'square'}
				name={ref.title}
				image={ref.image}
				size={size === 'lg' ? 'avatar-md' : 'avatar-sm'}
				class="{avatarSize} shrink-0"
			/>
		{/if}
		<div class="min-w-0 flex-1">
			{@render titleRow()}
			{#if hasSub}
				<div class="truncate text-muted">
					{#if hasContact}{@render contact()}{:else if subtitle}{@render subtitle()}{:else}{ref.subtitle}{/if}
				</div>
			{/if}
		</div>
		{#if meta}
			<div class="flex shrink-0 gap-2">{@render meta()}</div>
		{/if}
	</div>
{/if}

{#snippet contact()}
	{#if email}
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- mailto:, not an internal route -->
		<a class="link" href="mailto:{email}">{email}</a>
	{/if}
	{#if email && phone}·{/if}
	{#if phone}
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- tel:, not an internal route -->
		<a class="link" href="tel:{phone}">{phone}</a>
	{/if}
{/snippet}
