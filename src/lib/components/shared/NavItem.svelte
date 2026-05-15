<script lang="ts">
	import type { Snippet } from 'svelte';

	let { href, label, icon }: {
		href: string;
		label: string;
		icon?: Snippet;
	} = $props();
</script>

<li>
	<a {href}>
		{@render icon?.()}
		{label}
	</a>
</li>
