<script lang="ts">
	import { IconCopy } from '@tabler/icons-svelte';

	let {
		value,
		label = ''
	}: {
		value: string;
		label?: string;
	} = $props();

	const display = $derived(
		value.length > 16 ? `${value.slice(0, 10)}...${value.slice(-4)}` : value
	);
</script>

<div>
	{#if label}
		<p class="text-xs opacity-50">{label}</p>
	{/if}
	<div class="mt-1 flex items-center gap-2">
		<code class="text-xs opacity-70">{display}</code>
		<button
			class="btn btn-ghost btn-xs"
			onclick={() => navigator.clipboard.writeText(value)}
			title="Copy"
		>
			<IconCopy size={14} />
		</button>
	</div>
</div>
