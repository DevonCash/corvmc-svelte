<script lang="ts">
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import DateBlockCard from '$lib/components/shared/DateBlockCard.svelte';
	import { formatDate, formatTime } from '$lib/utils/format';
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
	<DateBlockCard date={ticket.event.startsAt} class={className}>
		<div class="flex items-center justify-between gap-2">
			<span class="text-sm font-semibold">{ticket.event.title}</span>
			<StatusBadge status={ticket.status} />
		</div>
		<p class="text-sm opacity-60">
			{formatDate(ticket.event.startsAt)} · {formatTime(ticket.event.startsAt)}
		</p>
		<span class="font-mono text-xs opacity-40">{ticket.code}</span>
	</DateBlockCard>
{/if}
