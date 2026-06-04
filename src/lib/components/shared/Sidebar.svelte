<script lang="ts">
	import type { Snippet } from 'svelte';
	import Badge from '$lib/components/shared/Badge.svelte';

	let {
		title = 'CorvMC',
		badge = 'Staff',
		navigation,
		brand
	}: {
		title?: string;
		badge?: string;
		navigation?: Snippet;
		brand?: Snippet;
	} = $props();
</script>

<aside class="flex h-full w-64 flex-col bg-base-200 text-base-content">
	<!-- Logo area (mobile only) -->
	<div>
		{#if brand}
			{@render brand()}
		{:else}
			<div class="flex items-center gap-2 px-6 py-5">
				<span class="truncate text-xl font-bold">{title}</span>
				<Badge variant="primary">{badge}</Badge>
			</div>
		{/if}

		<div class="tri-stripe"></div>
	</div>

	<!-- Nav links -->
	<ul class="menu w-full flex-1 gap-1">
		{@render navigation?.()}
	</ul>
</aside>
