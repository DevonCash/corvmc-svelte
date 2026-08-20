<script lang="ts">
	import clsx from 'clsx';
	import type { EntityRef } from '$lib/types/entity';
	import StatusBadge from '../StatusBadge.svelte';
	import { entityIcon, isNoteworthyStatus } from './registry';
	import { getEntityViewer } from './context';
	import { entityHref } from '$lib/utils/entity-href';

	/**
	 * An inline reference to another record: type glyph + its distinctive name,
	 * in a chip, linked to whichever page this viewer can reach.
	 *
	 * The smallest of the four tiers. Use it wherever one record *mentions*
	 * another — the flagged item on a report, the band on a reservation, the
	 * submitter on an event.
	 *
	 * A contained chip rather than a bare link because these appear inside
	 * running prose and fact lists, where an underlined name is indistinguishable
	 * from any other link in the sentence. The container says "this is a record
	 * you can open", and the glyph says which kind — which is the entire job of
	 * this tier.
	 *
	 * Takes no `href`: see `$lib/utils/entity-href`.
	 */
	let {
		ref,
		icon = true,
		status = true,
		class: className = '',
		preview: _preview = false
	}: {
		ref: EntityRef;
		/** The type glyph. Off when surrounding context already names the type. */
		icon?: boolean;
		/**
		 * Trail a glyph when the record needs attention. Exception-only, like
		 * everywhere else — an `active` member trails nothing.
		 */
		status?: boolean;
		class?: string;
		/**
		 * RESERVED, not yet implemented — mounts `EntityRow` in a hover popover.
		 * Declared now so adding it later is an implementation rather than an API
		 * change.
		 */
		preview?: boolean;
	} = $props();

	const viewer = getEntityViewer();
	const href = $derived(entityHref(ref, viewer));
	const glyph = $derived(entityIcon(ref));
	/**
	 * A cancelled show and a live one were pixel-identical, which made the chip
	 * quietly lie in the one place it is most likely to be read in passing —
	 * mid-sentence, where nobody goes looking for a status column.
	 *
	 * A trailing glyph rather than a tinted border: chips run several to a
	 * paragraph, and colouring the container would shout across the whole page
	 * to say one of them is off.
	 */
	const notable = $derived(status && isNoteworthyStatus(ref.status));

	const classes = $derived(
		clsx(
			// h-6 is one line box exactly (24px, matching the body leading), so a chip
			// in running prose does not push the lines apart. A Material chip is
			// taller than this, but Material chips live in chip *groups* — these have
			// to sit inside a sentence.
			'inline-flex h-6 max-w-full min-w-0 items-center gap-1.5 rounded-full border align-bottom text-sm',
			// Material's leading-icon inset: the glyph sits closer to the edge than
			// the label does, or the chip reads lopsided.
			icon ? 'pl-2' : 'pl-3',
			notable ? 'pr-2' : 'pr-3',
			href
				? 'border-base-300 bg-base-200 transition-colors hover:border-base-content/20 hover:bg-base-300'
				: // Unreachable or deleted. Same shape, so a list of chips stays a list
					// of chips, but nothing that suggests it can be opened.
					'border-base-300/60 bg-base-200/50 text-muted',
			className
		)
	);
</script>

{#if href}
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- href comes from entityHref(), which calls resolve() internally; the rule cannot trace it through the function -->
	<a {href} class={classes}>
		{#if icon}<glyph.icon size={16} class="shrink-0" />{/if}
		<span class="min-w-0 truncate">{ref.title}</span>
		{#if notable && ref.status}<StatusBadge status={ref.status} size={14} />{/if}
	</a>
{:else}
	<span class={classes}>
		{#if icon}<glyph.icon size={16} class="shrink-0 opacity-60" />{/if}
		<span class="min-w-0 truncate">{ref.title}</span>
		{#if notable && ref.status}<StatusBadge status={ref.status} size={14} />{/if}
	</span>
{/if}
