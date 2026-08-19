<script lang="ts">
	import type { EntityRef } from '$lib/types/entity';
	import { entityKinds } from './registry';
	import { getEntityViewer } from './context';
	import { entityHref } from '$lib/utils/entity-href';

	/**
	 * An inline reference to another record: type glyph + its distinctive name,
	 * linked to whichever page this viewer can reach.
	 *
	 * The smallest of the four tiers. Use it wherever one record *mentions*
	 * another mid-sentence or in a fact list — the flagged item on a report, the
	 * band on a reservation, the submitter on an event.
	 *
	 * Takes no `href`: see `$lib/utils/entity-href`.
	 */
	let {
		ref,
		icon = true,
		class: className = '',
		preview: _preview = false
	}: {
		ref: EntityRef;
		/** The type glyph. Off when surrounding context already names the type. */
		icon?: boolean;
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
	const Icon = $derived(entityKinds[ref.type].icon);
</script>

{#if href}
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- href comes from entityHref(), which calls resolve() internally; the rule cannot trace it through the function -->
	<a {href} class="link inline-flex max-w-full min-w-0 items-center gap-1 align-bottom {className}">
		{#if icon}<Icon size={14} class="shrink-0" />{/if}
		<span class="min-w-0 truncate">{ref.title}</span>
	</a>
{:else}
	<!--
		Unreachable, or the record is gone. Deliberately still rendered: dropping
		it would silently shorten lists and leave sentences dangling. It just
		doesn't link — no `href="#"`, which would put a dead anchor in the
		accessibility tree.
	-->
	<span class="inline-flex max-w-full min-w-0 items-center gap-1 align-bottom {className}">
		{#if icon}<Icon size={14} class="shrink-0 opacity-60" />{/if}
		<span class="min-w-0 truncate">{ref.title}</span>
	</span>
{/if}
