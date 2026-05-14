<script lang="ts">
	import type { PageServerData } from './$types';
	import type { Column } from '$lib/components/DataTable.svelte';
	import DataTable from '$lib/components/DataTable.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import CreateEventModal from './CreateEventModal.svelte';

	let { data }: { data: PageServerData } = $props();
	let showCreateModal = $state(false);

	type Event = (typeof data.events)[number];

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-US', {
			timeZone: 'America/Los_Angeles',
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
	}

	function formatTimeRange(startsAt: string, endsAt: string): string {
		const fmt = (iso: string) =>
			new Date(iso).toLocaleTimeString('en-US', {
				timeZone: 'America/Los_Angeles',
				hour: 'numeric',
				minute: '2-digit'
			});
		return `${fmt(startsAt)} – ${fmt(endsAt)}`;
	}

	function parseTags(tags: string | null): string[] {
		if (!tags) return [];
		return tags.split(',').map((t) => t.trim()).filter(Boolean);
	}

	const columns: Column<Event>[] = [
		{ key: 'status', header: 'Status' },
		{ key: 'startsAt', header: 'Date', sortable: true },
		{ key: 'title', header: 'Title', sortable: true },
		{ key: 'tags', header: 'Tags' },
		{ key: 'reservationId', header: 'Space' }
	];
</script>

<div class="space-y-6">
	<PageHeader title="Events">
		<button class="btn btn-sm btn-primary" onclick={() => showCreateModal = true}>New Event</button>
	</PageHeader>

	<CreateEventModal bind:open={showCreateModal} />

	<DataTable data={data.events} {columns} empty="No events yet">
		{#snippet row(e)}
			<tr class="hover cursor-pointer" onclick={() => window.location.href = `/staff/events/${e.id}`}>
				<td>
					<StatusBadge status={e.status} />
				</td>
				<td>
					<div>{formatDate(e.startsAt)}</div>
					<div class="text-sm opacity-60">{formatTimeRange(e.startsAt, e.endsAt)}</div>
				</td>
				<td>
					{e.title}
				</td>
				<td>
					{#each parseTags(e.tags) as tag (tag)}
						<span class="badge badge-outline badge-sm mr-1">{tag}</span>
					{/each}
				</td>
				<td>
					{#if e.reservationId}
						<span class="badge badge-info badge-sm">Reserved</span>
					{:else}
						<span class="text-sm opacity-40">—</span>
					{/if}
				</td>
			</tr>
		{/snippet}
	</DataTable>
</div>
