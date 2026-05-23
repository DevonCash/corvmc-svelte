<script lang="ts">
	import type { Snippet } from 'svelte';
	import Button from '$lib/components/shared/Button.svelte';

	let {
		title,
		subtitle,
		backHref,
		children
	}: {
		title: string;
		backHref?: string;
		children?: Snippet;
		subtitle?: string;
	} = $props();


</script>

<div
	class="sticky top-0 z-10 -mx-6 flex flex-wrap items-center justify-between gap-2 border-b border-base-300 bg-base-100 px-6 py-4 mb-6"
>
	<div class="flex items-center gap-4">
		{#if backHref}
			<Button href={backHref} class="btn-square btn-ghost btn-lg">←</Button>
		{/if}
		<hgroup class="flex flex-col">
			<h1 class="text-2xl font-bold">{title}</h1>
			{#if subtitle}
				<span class="text-sm font-bold text-primary uppercase">{subtitle}</span>
			{/if}
		</hgroup>
	</div>
	{#if children}
		{@render children()}
	{/if}
</div>
