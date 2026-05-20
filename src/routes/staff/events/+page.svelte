<script lang="ts">
	import { default as DataTable, type Column } from '$lib/components/shared/Table/DataTable.svelte';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import CreateEventModal from './CreateEventModal.svelte';
	import { formatDate, formatTimeRange } from '$lib/utils/format';
	import Badge from '$lib/components/shared/Badge.svelte';
	import type { StaffEventsResponse } from '$lib/server/db/schema/api';

	let { data }: { data: StaffEventsResponse } = $props();
	let showCreateModal = $state(false);

	function buildPageHref(page: number): string {
		const params = new URLSearchParams();
		params.set('page', String(page));
		return `/staff/events?${params.toString()}`;
	}

	type Event = (typeof data.events)[number];

	function parseTags(tags: string | null): string[] {
		if (!tags) return [];
		return tags
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);
	}

	function dayLabel(e: Event): string {
		return formatDate(e.startsAt);
	}

	const columns: Column<Event>[] = [
		{ key: 'status', header: '' },
		{ key: 'title', header: 'Title', sortable: true },
		{ key: 'startsAt', header: 'Date', sortable: true },
		{ key: 'tags', header: 'Tags' },
		{ key: 'reservationId', header: 'Space' }
	];
</script>

<PageHeader title="Events">
		<button class="btn btn-sm btn-primary" onclick={() => (showCreateModal = true)}
			>New Event</button
		>
	</PageHeader>
<PageContent>
	<CreateEventModal bind:open={showCreateModal} />

	<DataTable data={data.events} {columns} groupBy={dayLabel} empty="No events yet"
		pagination={{ page: data.pagination.page, totalPages: data.pagination.totalPages }} {buildPageHref}>
		{#snippet row(e)}
			<tr
				class="hover cursor-pointer"
				onclick={() => (window.location.href = `/staff/events/${e.id}`)}
			>
				<td class="w-px">
					<StatusBadge status={e.status} />
				</td>
				<td>
					{e.title}
				</td>
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
		{/snippet}
	</DataTable>
</PageContent>
