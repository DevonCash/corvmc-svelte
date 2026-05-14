<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		class: extraClass = '',
		children,
		header
	}: {
		title: string;
		class?: string;
		children: Snippet;
		header?: Snippet<[title: string]>;
	} = $props();
</script>

<div class="card bg-base-100 shadow {extraClass}">
	<div class="card-body">
		{#if header}
			{@render header(title)}
		{:else}
			<h3 class="card-title">{title}</h3>
		{/if}
		{@render children()}
	</div>
</div>
