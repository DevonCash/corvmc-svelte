<script lang="ts" generics="T">
	/**
	 * An InfoCard whose body is one remote query.
	 *
	 * Every section of the staff user record loads independently — a slow
	 * subscription lookup must not blank the reservations next to it — so each
	 * one needs the same pending/error envelope. Without the `{:catch}` a failed
	 * query renders an empty card, which is indistinguishable from "this member
	 * has none of these"; that ambiguity is exactly what the Payment Records card
	 * shipped with and had to be fixed.
	 *
	 * Empty states stay with the caller: "no bands" and "no payments" want
	 * different words, and half of them want a link out.
	 */
	import type { Snippet } from 'svelte';
	import InfoCard from '$lib/components/shared/InfoCard.svelte';
	import Alert from '$lib/components/shared/Alert.svelte';

	let {
		title,
		result,
		class: className = '',
		header,
		children
	}: {
		title: string;
		result: Promise<T>;
		class?: string;
		header?: Snippet<[title: string]>;
		children: Snippet<[T]>;
	} = $props();
</script>

<InfoCard {title} class={className} {header}>
	{#await result}
		<div class="flex justify-center py-8">
			<span class="loading loading-spinner loading-sm"></span>
		</div>
	{:then value}
		{@render children(value)}
	{:catch}
		<Alert type="warning">Could not load {title.toLowerCase()}.</Alert>
	{/await}
</InfoCard>
