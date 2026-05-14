<script lang="ts">
	import type { PageServerData } from './$types';
	import { default as DataTable, type Column } from '$lib/components/shared/Table/DataTable.svelte';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import CreateEventModal from './CreateEventModal.svelte';
	import { formatDate, formatTimeRange } from '$lib/utils/format';

	let { data }: { data: PageServerData } = $props();
	let showCreateModal = $state(false);

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

<div class="space-y-6">
	<PageHeader title="Events">
		<button class="btn btn-sm btn-primary" onclick={() => (showCreateModal = true)}
			>New Event</button
		>
	</PageHeader>

	<CreateEventModal bind:open={showCreateModal} />

	<DataTable data={data.events} {columns} groupBy={dayLabel} empty="No events yet">
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
						<span class="mr-1 badge badge-outline badge-sm">{tag}</span>
					{/each}
				</td>
				<td>
					{#if e.reservationId}
						<span class="badge badge-sm badge-info">Reserved</span>
					{:else}
						<span class="text-sm opacity-40">—</span>
					{/if}
				</td>
			</tr>
		{/snippet}
	</DataTable>
</div>
