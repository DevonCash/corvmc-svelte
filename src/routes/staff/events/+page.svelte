<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Pagination from '$lib/components/shared/Pagination.svelte';
	import CreateEventModal from './CreateEventModal.svelte';
	import { formatDate, formatTimeRange } from '$lib/utils/format';
	import Badge from '$lib/components/shared/Badge.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import { getStaffEvents } from '$lib/remote/events.remote';

	let page = $state(1);
	let showCreateModal = $state(false);

	let result = $derived(getStaffEvents({ page }));

	type Event = Awaited<typeof result>['rows'][number];

	function parseTags(tags: string | null): string[] {
		if (!tags) return [];
		return tags.split(',').map((t) => t.trim()).filter(Boolean);
	}

	function dayLabel(e: Event): string {
		return formatDate(e.startsAt);
	}
</script>

<PageHeader title="Events">
	<Button class="btn-sm" onclick={() => (showCreateModal = true)}>New Event</Button>
</PageHeader>
<PageContent>
	<CreateEventModal bind:open={showCreateModal} />

	{#await result}
		<div class="flex justify-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:then { rows: events, pagination }}
		{#if events.length === 0}
			<p class="text-center opacity-60 py-8">No events yet</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="table">
					<thead>
						<tr>
							<th class="w-px"></th>
							<th>Title</th>
							<th>Date</th>
							<th>Tags</th>
							<th>Space</th>
						</tr>
					</thead>
					<tbody>
						{#each events as e, idx (e.id)}
							{@const label = dayLabel(e)}
							{@const prevLabel = idx > 0 ? dayLabel(events[idx - 1]) : null}
							{#if label !== prevLabel}
								<tr>
									<td colspan="5" class="bg-base-200 px-4 py-2 text-xs font-semibold tracking-wide uppercase opacity-60">
										{label}
									</td>
								</tr>
							{/if}
							<tr
								class="hover cursor-pointer"
								onclick={() => (window.location.href = `/staff/events/${e.id}`)}
							>
								<td class="w-px">
									<StatusBadge status={e.status} />
								</td>
								<td>{e.title}</td>
								<td>
									<div>{formatDate(e.startsAt)}</div>
									<div class="text-sm opacity-60">{formatTimeRange(e.startsAt, e.endsAt)}</div>
								</td>
								<td>
									{#each parseTags(e.tags) as tag (tag)}
										<Badge variant="outline" class="mr-1">{tag}</Badge>
									{/each}
								</td>
								<td>
									{#if e.reservationId}
										<Badge variant="info">Reserved</Badge>
									{:else}
										<span class="text-sm opacity-40">—</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<Pagination page={pagination.page} totalPages={pagination.totalPages} onpage={(p) => page = p} />
		{/if}
	{/await}
</PageContent>
