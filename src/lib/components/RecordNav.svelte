<script lang="ts">
	import { IconArrowLeft, IconArrowRight } from '@tabler/icons-svelte';

	let {
		prevHref,
		nextHref,
		endLabel = ''
	}: {
		prevHref?: string;
		nextHref?: string;
		endLabel?: string;
	} = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
		if (e.key === 'ArrowLeft' && prevHref) {
			window.location.href = prevHref;
		} else if (e.key === 'ArrowRight' && nextHref) {
			window.location.href = nextHref;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="flex items-center gap-4">
	{#if prevHref}
		<a href={prevHref} class="btn btn-ghost btn-sm" title="Previous (←)">
			<IconArrowLeft size={16} />
			Prev
		</a>
	{:else}
		<span class="btn btn-disabled btn-ghost btn-sm">
			<IconArrowLeft size={16} />
			Prev
		</span>
	{/if}

	{#if nextHref}
		<a href={nextHref} class="btn btn-ghost btn-sm" title="Next (→)">
			Next
			<IconArrowRight size={16} />
		</a>
	{:else if endLabel}
		<span class="text-xs opacity-50">{endLabel}</span>
	{:else}
		<span class="btn btn-disabled btn-ghost btn-sm">
			Next
			<IconArrowRight size={16} />
		</span>
	{/if}
</div>
