<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { EntityRef } from '$lib/types/entity';
	import Card from '../Card/Card.svelte';
	import CardBody from '../Card/CardBody.svelte';
	import EntityAvatar from '../directory/EntityAvatar.svelte';
	import StatusBadge from '../StatusBadge.svelte';
	import { imageSrc } from '$lib/utils/images';
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
	 * The media slot is a fixed box the image is cropped into, so the card's
	 * text column starts at the same x whatever the type. Posters are portrait —
	 * a gig poster is never landscape, and cropping one into a wide strip throws
	 * away the half that carries the lineup.
	 */
	const isPoster = $derived(media === 'poster' || (media === 'auto' && kind.shape === 'poster'));
	// Keyed off the *shape*, not off whether an image happened to load: an event
	// with no artwork yet keeps the portrait box, so a grid of cards still lines
	// its text columns up.
	const boxClass = $derived(
		isPoster
			? 'aspect-[2/3] w-24 rounded-md'
			: kind.shape === 'round'
				? 'size-14 rounded-full'
				: 'size-14 rounded-lg'
	);
	const poster = $derived(ref.image ? imageSrc(ref.image, 'poster') : null);
</script>

<Card class={className}>
	<CardBody>
		<div class="flex min-w-0 items-start gap-3">
			{#if mode === 'poster' && poster}
				<figure class="shrink-0 overflow-hidden bg-base-200 {boxClass}">
					<img
						src={poster.src}
						srcset={poster.srcset}
						sizes={poster.sizes}
						alt=""
						class="size-full object-cover"
						loading="lazy"
					/>
				</figure>
			{:else if mode === 'avatar'}
				<EntityAvatar
					shape={kind.shape === 'round' ? 'round' : 'square'}
					name={ref.title}
					image={ref.image}
					size="avatar-md"
					class="size-14 shrink-0"
				/>
			{:else if mode !== 'none'}
				<div
					class="flex shrink-0 items-center justify-center bg-base-200 {boxClass}"
					aria-hidden="true"
				>
					<Icon size={isPoster ? 40 : 28} class="text-subtle" />
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
