<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { EntityRef } from '$lib/types/entity';
	import Card from '../Card/Card.svelte';
	import CardBody from '../Card/CardBody.svelte';
	import EntityAvatar from '../directory/EntityAvatar.svelte';
	import StatusBadge from '../StatusBadge.svelte';
	import { imageSrc } from '$lib/utils/images';
	import { entityKinds, statusRing } from './registry';
	import { variants } from '../StatusBadge.svelte';
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
		 * `auto` follows the registry's shape for the type. Override only to
		 * suppress the media slot, or to force a shape the registry doesn't give.
		 */
		media?: 'auto' | 'avatar' | 'poster' | 'icon' | 'none';
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
	const Icon = $derived(kind.icon);

	/**
	 * `icon` is the no-image answer at every shape.
	 *
	 * A card is big enough that the fallback has to *say* something, and initials
	 * on a generated pattern say the least: two letters repeating the title
	 * printed right beside them. Most of these types have no image at all — a
	 * reservation, a report, a campaign — so the glyph is not a fallback for them
	 * but the only honest illustration, which is why `auto` reaches for it rather
	 * than dropping the media slot.
	 */
	const mode = $derived.by(() => {
		if (media !== 'auto') return media === 'none' ? 'none' : media;
		if (!ref.image) return 'icon';
		if (kind.shape === 'poster') return 'poster';
		if (kind.shape === 'none') return 'icon';
		return 'avatar';
	});

	/**
	 * A poster type turns the whole card portrait: full-bleed 2:3 artwork with
	 * the text underneath, the way a poster is actually looked at. The other
	 * shapes keep the media as a small tile beside the text.
	 *
	 * Keyed off the *shape*, not off whether an image loaded, so an event with no
	 * artwork yet is still a portrait card and a grid of them stays even.
	 */
	const isPoster = $derived(media === 'poster' || (media === 'auto' && kind.shape === 'poster'));
	const tileClass = $derived(kind.shape === 'round' ? 'rounded-full' : 'rounded-lg');
	const poster = $derived(ref.image ? imageSrc(ref.image, 'poster') : null);

	/**
	 * Status rides on the media rather than sitting beside the title: an outline
	 * in its colour, and the glyph in the corner.
	 *
	 * A labelled badge on the title line was reading louder than the record's own
	 * name, and on a poster card it clipped every title to an ellipsis. The mark
	 * is the unlabelled `StatusBadge`, so it keeps that component's tooltip and
	 * its humanised label — icon-only here does not mean unlabelled to a reader.
	 *
	 * With `media="none"` there is no media to ride on, so the badge stays inline.
	 */
	const inMedia = $derived(status && !!ref.status && mode !== 'none');
	const ringClass = $derived.by(() => {
		if (!inMedia || !ref.status) return '';
		const colour = variants[ref.status]?.color;
		return `ring-2 ${(colour && statusRing[colour]) || 'ring-base-content/30'}`;
	});
</script>

<Card class={className}>
	{#if isPoster}
		<div class="relative">
			<figure class="aspect-[2/3] w-full overflow-hidden bg-base-200">
				{#if poster}
					<img
						src={poster.src}
						srcset={poster.srcset}
						sizes={poster.sizes}
						alt=""
						class="size-full object-cover"
						loading="lazy"
					/>
				{:else}
					<div class="flex size-full items-center justify-center">
						<Icon size={64} class="text-subtle" />
					</div>
				{/if}
			</figure>
			{#if ringClass}
				<!--
					The ring is its own overlay rather than a class on the figure. An
					inset ring is a box-shadow, which paints under the element's content,
					so the poster image covered it completely — and an *outset* ring gets
					clipped by the card's own rounded corners. This sits above both.
				-->
				<div class="pointer-events-none absolute inset-0 {ringClass} ring-inset"></div>
			{/if}
			{#if inMedia && ref.status}
				<span
					class="absolute right-2 bottom-2 flex size-7 items-center justify-center rounded-full bg-base-100 shadow"
				>
					<StatusBadge status={ref.status} size={16} />
				</span>
			{/if}
		</div>
	{/if}
	<CardBody>
		<div class="flex min-w-0 items-start gap-3">
			<!-- On a poster card the artwork is above, so nothing sits beside the title. -->
			{#if !isPoster && mode !== 'none'}
				<div class="relative shrink-0">
					{#if mode === 'avatar'}
						<EntityAvatar
							shape={kind.shape === 'round' ? 'round' : 'square'}
							name={ref.title}
							image={ref.image}
							size="avatar-md"
							class="size-14 {ringClass}"
						/>
					{:else}
						<div
							class="flex size-14 items-center justify-center bg-base-200 {tileClass} {ringClass}"
							aria-hidden="true"
						>
							<Icon size={28} class="text-subtle" />
						</div>
					{/if}
					{#if inMedia && ref.status}
						<span
							class="absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full bg-base-100"
						>
							<StatusBadge status={ref.status} size={14} />
						</span>
					{/if}
				</div>
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
			{#if status && ref.status && !inMedia}
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
