<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		class: extraClass = '',
		children
	}: {
		title: string;
		class?: string;
		children: Snippet;
	} = $props();
</script>

<div class="card bg-base-100 shadow {extraClass}">
	<div class="card-body">
		<h3 class="mb-3 text-sm font-medium opacity-60">{title}</h3>
		{@render children()}
	</div>
</div>
