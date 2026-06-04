<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		action,
		children
	}: {
		title: string;
		action?: Snippet;
		children: Snippet;
	} = $props();
</script>

<li class="menu-title flex flex-row items-center justify-between">
	<span>{title}</span>
	{#if action}
		{@render action()}
	{/if}
</li>
<ul>{@render children()}</ul>
