<script lang="ts">
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import ActionGroup from '$lib/components/shared/ActionGroup.svelte';
	import { formatDate, formatTime, formatDayOfWeek, formatDayNumber, formatShortMonth } from '$lib/utils/format';
	import type { MemberTicketsResponse } from '$lib/server/db/schema/api';

	let {
		ticket,
		class: className = ''
	}: {
		ticket: MemberTicketsResponse['tickets'][number];
		class?: string;
	} = $props();
</script>

{#if ticket.event}
	<div class="flex rounded-md border-[2.5px] border-(--cmc-brown) bg-base-100 {className}">
		<div
			class="flex w-20 shrink-0 flex-col items-center justify-center rounded-l-sm border-r-2 border-(--cmc-brown) bg-primary py-3 text-primary-content"
		>
			<span class="text-xs leading-tight font-bold">{formatDayOfWeek(ticket.event.startsAt)}</span>
			<span class="text-3xl leading-tight font-bold">{formatDayNumber(ticket.event.startsAt)}</span>
			<span class="text-xs leading-tight font-bold">{formatShortMonth(ticket.event.startsAt)}</span>
		</div>
		<div class="flex min-w-0 flex-1 flex-col">
			<div class="flex flex-1 flex-col gap-1 px-4 py-3">
				<div class="flex items-center justify-between gap-2">
					<span class="text-sm font-semibold">{ticket.event.title}</span>
					<StatusBadge status={ticket.status} />
				</div>
				<p class="text-sm opacity-60">
					{formatDate(ticket.event.startsAt)} · {formatTime(ticket.event.startsAt)}
				</p>
				<span class="font-mono text-xs opacity-40">{ticket.code}</span>
			</div>
			<div class="flex min-h-5 items-center justify-end rounded-br-lg bg-base-200 pt-0">
			</div>
		</div>
	</div>
{/if}
