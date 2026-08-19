<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { EntityRef } from '$lib/types/entity';
	import EntityAvatar from '../directory/EntityAvatar.svelte';
	import StatusBadge from '../StatusBadge.svelte';
	import { entityKinds } from './registry';

	/**
	 * The identity strip on a record's own detail page — avatar, name, the
	 * qualifiers that are true regardless of which tab is open, and contact
	 * links.
	 *
	 * Sits directly below `PageHeader`, above any `TabBar`. Deliberately *not*
	 * linked: you are already on this record's page, so its own name is not a
	 * navigation target.
	 *
	 * This is as far as the "detail" tier goes as a component. The four event
	 * detail pages are 319–883 lines and share no skeleton below this strip, so
	 * the rest is a documented page recipe (PageHeader → EntityHeader →
	 * InfoCard/DefinitionList sections → RelatedList) rather than an
	 * `<EntityDetail>` that would be `PageContent` with extra steps.
	 */
	let {
		ref,
		email,
		phone,
		class: className = '',
		qualifiers,
		actions
	}: {
		ref: EntityRef;
		email?: string | null;
		phone?: string | null;
		class?: string;
		/** Extra inline facts beside the name — a member number, a tier. */
		qualifiers?: Snippet;
		actions?: Snippet;
	} = $props();

	const kind = $derived(entityKinds[ref.type]);
</script>

<div class="flex flex-wrap items-center gap-4 {className}">
	{#if kind.shape !== 'none'}
		<EntityAvatar
			shape={kind.shape === 'round' ? 'round' : 'square'}
			name={ref.title}
			image={ref.image}
			size="avatar-md"
			class="size-16 shrink-0"
		/>
	{/if}
	<div class="min-w-0 flex-1">
		<div class="flex flex-wrap items-baseline gap-2">
			<span class="text-lg font-medium">{ref.title}</span>
			{#if ref.type === 'member' && ref.pronouns}
				<span class="text-muted">{ref.pronouns}</span>
			{/if}
			{#if qualifiers}{@render qualifiers()}{/if}
			{#if ref.status}
				<StatusBadge status={ref.status} label />
			{/if}
		</div>
		{#if email || phone || ref.subtitle}
			<div class="text-muted">
				{#if email}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- mailto:, not an internal route -->
					<a class="link" href="mailto:{email}">{email}</a>
				{/if}
				{#if email && phone}·{/if}
				{#if phone}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- tel:, not an internal route -->
					<a class="link" href="tel:{phone}">{phone}</a>
				{/if}
				{#if !email && !phone && ref.subtitle}{ref.subtitle}{/if}
			</div>
		{/if}
	</div>
	{#if actions}
		<div class="flex shrink-0 gap-2">{@render actions()}</div>
	{/if}
</div>
