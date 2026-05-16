<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import { fullDate, formatTime } from '$lib/utils/format';
	import type { MemberTicketsResponse } from '$lib/types/api';

	let { data }: { data: MemberTicketsResponse } = $props();

	const upcoming = $derived(
		data.tickets.filter(
			(t) => t.event && new Date(t.event.startsAt) > new Date() && t.status !== 'cancelled'
		)
	);
	const past = $derived(
		data.tickets.filter(
			(t) => !t.event || new Date(t.event.startsAt) <= new Date() || t.status === 'cancelled'
		)
	);
</script>

<div class="max-w-2xl mx-auto space-y-6">
	<PageHeader title="My Tickets" />

	{#if data.tickets.length === 0}
		<EmptyState
			title="No tickets yet"
			description="Tickets you purchase for events will appear here."
			actionLabel="Browse Events"
			actionHref="/events"
		/>
	{:else}
		{#if upcoming.length > 0}
			<h3 class="text-sm font-medium opacity-60 uppercase tracking-wide">Upcoming</h3>
			<div class="space-y-3">
				{#each upcoming as ticket (ticket.id)}
					<div class="card bg-base-100 shadow">
						<div class="card-body p-4 flex-row items-center justify-between">
							<div>
								<p class="font-medium">{ticket.event?.title ?? 'Unknown Event'}</p>
								{#if ticket.event}
									<p class="text-sm opacity-60">
										{fullDate(ticket.event.startsAt)} · {formatTime(ticket.event.startsAt)}
									</p>
								{/if}
								<p class="font-mono text-xs opacity-50 mt-1">{ticket.code}</p>
							</div>
							<StatusBadge status={ticket.status} />
						</div>
					</div>
				{/each}
			</div>
		{/if}

		{#if past.length > 0}
			<h3 class="text-sm font-medium opacity-60 uppercase tracking-wide">Past</h3>
			<div class="space-y-3">
				{#each past as ticket (ticket.id)}
					<div class="card bg-base-100 shadow opacity-60">
						<div class="card-body p-4 flex-row items-center justify-between">
							<div>
								<p class="font-medium">{ticket.event?.title ?? 'Unknown Event'}</p>
								{#if ticket.event}
									<p class="text-sm opacity-60">
										{fullDate(ticket.event.startsAt)}
									</p>
								{/if}
								<p class="font-mono text-xs opacity-50 mt-1">{ticket.code}</p>
							</div>
							<StatusBadge status={ticket.status} />
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>
