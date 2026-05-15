<script lang="ts">
	import type { Snippet } from 'svelte';

	let { href, label, icon } = $props() as {
		href: string;
		label: string;
		icon?: Snippet;
	};
</script>

<li>
	<a {href}>
		{@render icon?.()}
		{label}
	</a>
</li>
