<script lang="ts">
	import type { Snippet } from 'svelte';
	import { formatDayOfWeek, formatDayNumber, formatShortMonth } from '$lib/utils/format';
	import ActionGroup from './ActionGroup.svelte';

	let {
		date,
		children,
		actions,
		class: className = ''
	}: {
		date: string;
		children: Snippet;
		actions?: Snippet;
		class?: string;
	} = $props();
</script>

<div class="flex overflow-hidden rounded-(--radius-box) border-2 border-(--cmc-brown) bg-base-100 {className}">
	<div
		class="flex w-20 shrink-0 flex-col items-center justify-center border-r-2 border-(--cmc-brown) bg-(--cmc-parchment) py-3"
	>
		<span class="eyebrow text-xs leading-tight text-(--cmc-brown)">{formatDayOfWeek(date)}</span>
		<span class="text-3xl font-bold leading-tight text-(--cmc-brown)">{formatDayNumber(date)}</span>
		<span class="eyebrow text-xs leading-tight text-(--cmc-brown)">{formatShortMonth(date)}</span>
	</div>
	<div class="flex min-w-0 flex-1 flex-col">
		<div class="flex flex-1 flex-col gap-1 px-4 py-3">
			{@render children()}
		</div>
		{#if actions}
			<div class="flex items-center justify-end px-4 pb-3">
				<ActionGroup>
					{@render actions()}
				</ActionGroup>
			</div>
		{/if}
	</div>
</div>
