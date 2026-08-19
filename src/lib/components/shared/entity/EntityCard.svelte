<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { EntityRef } from '$lib/types/entity';
	import Card from '../Card/Card.svelte';
	import CardBody from '../Card/CardBody.svelte';
	import EntityAvatar from '../directory/EntityAvatar.svelte';
	import StatusBadge from '../StatusBadge.svelte';
	import { imageSrc } from '$lib/utils/images';
	import { hashPattern } from '$lib/utils/patterns';
	import { entityKinds } from './registry';
	import { getEntityViewer } from './context';
	import { entityHref } from '$lib/utils/entity-href';

	/**
	 * One record, expanded: image, name, status, a few facts, and its actions.
	 *
	 * This is what a *related* record looks like on someone else's detail page —
	 * the band on an event, the member on a reservation. Bigger than a row,
	 * smaller than the page itself.
	 *
	 * Built on `Card`/`CardBody` rather than `InfoCard` on purpose: an
	 * `InfoCard`'s title is a section label ("Payment"), whereas this card's
	 * title *is* the record and links to it. Overloading `InfoCard`'s `header`
	 * snippet for that reproduces the "hardcoded to one shape" problem that
	 * motivated `Card` in the first place.
	 */
	let {
		ref,
		media = 'auto',
		status = true,
		class: className = '',
		facts,
		actions,
		children
	}: {
		ref: EntityRef;
		/**
		 * `auto` takes the avatar shape from the registry, and falls back to
		 * `none` for types that have no image. `banner` is the wide crop, for
		 * posters.
		 */
		media?: 'auto' | 'avatar' | 'banner' | 'none';
		status?: boolean;
		class?: string;
		/** A `DefinitionList` of the facts worth showing at this size. */
		facts?: Snippet;
		actions?: Snippet;
		children?: Snippet;
	} = $props();

	const viewer = getEntityViewer();
	const href = $derived(entityHref(ref, viewer));
	const kind = $derived(entityKinds[ref.type]);
	const mode = $derived(media === 'auto' ? (kind.shape === 'none' ? 'none' : 'avatar') : media);
	const banner = $derived(ref.image ? imageSrc(ref.image, 'gallery') : null);
</script>

<Card class={className}>
	{#if mode === 'banner'}
		<figure class="h-32 w-full overflow-hidden">
			{#if banner}
				<img
					src={banner.src}
					srcset={banner.srcset}
					sizes={banner.sizes}
					alt=""
					class="size-full object-cover"
					loading="lazy"
				/>
			{:else}
				<!-- The generated pattern, not a grey box: a listing with no poster
				     should still look like something. -->
				<div class="poster-gen size-full poster-gen--{hashPattern(ref.title)}"></div>
			{/if}
		</figure>
	{/if}
	<CardBody>
		<div class="flex min-w-0 items-start gap-3">
			{#if mode === 'avatar'}
				<EntityAvatar
					shape={kind.shape === 'none' ? 'square' : kind.shape}
					name={ref.title}
					image={ref.image}
					size="avatar-md"
					class="size-14 shrink-0"
				/>
			{/if}
			<div class="min-w-0 flex-1">
				<!--
					The truncate lives on an inner <span>, not on the <h3>. `layout.css`
					sets `text-wrap: balance` on h1–h6 *unlayered*, and unlayered CSS
					beats every @layer — so no utility can win on the heading itself and
					`truncate` silently half-applies (overflow and ellipsis take, nowrap
					does not). Inherited values do lose to a direct declaration, which is
					why the span works.
				-->
				<h3 class="font-semibold">
					{#if href}
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- href comes from entityHref(), which calls resolve() internally; the rule cannot trace it through the function -->
						<a {href} class="block truncate hover:underline">{ref.title}</a>
					{:else}
						<span class="block truncate">{ref.title}</span>
					{/if}
				</h3>
				{#if ref.subtitle}
					<!-- A <div>, not a <p>: `layout.css` sets `text-wrap: pretty` on p
					     unlayered, which defeats `truncate` the same way `balance` does on
					     headings. EntityRow uses a <div> here for the same reason. -->
					<div class="truncate text-muted">{ref.subtitle}</div>
				{/if}
			</div>
			{#if status && ref.status}
				<StatusBadge status={ref.status} label />
			{/if}
		</div>

		{#if facts}{@render facts()}{/if}
		{#if children}{@render children()}{/if}
		{#if actions}
			<div class="flex justify-end gap-2 pt-2">{@render actions()}</div>
		{/if}
	</CardBody>
</Card>
