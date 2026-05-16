<script lang="ts">
	import type { Snippet } from 'svelte';

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

	let scrollY = $state(0);
</script>

<div
	class="-mx-6 flex items-center justify-between bg-base-100 px-6 py-4"
>
	<div class="flex items-center gap-4">
		{#if backHref}
			<a href={backHref} class="btn btn-square btn-ghost btn-lg">←</a>
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
