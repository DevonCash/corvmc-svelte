<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, children }: {
		title: string;
		children: Snippet;
	} = $props();
</script>

<li class="menu-title">{title}</li>
<ul>{@render children()}</ul>
