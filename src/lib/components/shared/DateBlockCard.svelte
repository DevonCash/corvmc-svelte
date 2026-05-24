<script lang="ts">
	import type { Snippet } from 'svelte';
	import { formatDayOfWeek, formatDayNumber, formatShortMonth } from '$lib/utils/format';
	import type { ISODateString } from '$lib/types/dates';
	import ButtonGroup from './ButtonGroup.svelte';

	let {
		date,
		children,
		actions,
		class: className = ''
	}: {
		date: ISODateString;
		children: Snippet;
		actions?: Snippet;
		class?: string;
	} = $props();
</script>

<div class="flex rounded-md border-[2.5px] border-(--cmc-brown) bg-base-100 {className}">
	<div
		class="flex w-20 shrink-0 flex-col items-center justify-center rounded-l-sm border-r-2 border-(--cmc-brown) bg-primary py-3 text-primary-content"
	>
		<span class="text-xs leading-tight font-bold">{formatDayOfWeek(date)}</span>
		<span class="text-3xl leading-tight font-bold">{formatDayNumber(date)}</span>
		<span class="text-xs leading-tight font-bold">{formatShortMonth(date)}</span>
	</div>
	<div class="flex min-w-0 flex-1 flex-col">
		<div class="flex flex-1 flex-col gap-1 px-4 py-3">
			{@render children()}
		</div>
		<div class="flex min-h-5 items-center justify-end rounded-br-lg bg-base-200 pt-0">
			{#if actions}
				<ButtonGroup class="m-[-2.4px]">
					{@render actions()}
				</ButtonGroup>
			{/if}
		</div>
	</div>
</div>
