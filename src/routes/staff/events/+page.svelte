<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import DataList from '$lib/components/shared/DataList.svelte';
	import Table from '$lib/components/shared/Table.svelte';
	import { rowLink } from '$lib/actions/row-link';
	import { resolve } from '$app/paths';
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
		return tags
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);
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

	<DataList {result} empty="No events yet" onpage={(p) => (page = p)}>
		{#snippet children(events)}
			<!-- No zebra: the bg-base-200 day-group rows are the striping here. -->
			<Table zebra={false}>
				{#snippet head()}
					<th class="w-px"><span class="sr-only">Status</span></th>
					<th>Event</th>
					<th class="col-support">Tags</th>
					<th class="col-extra w-px">Space</th>
				{/snippet}

				{#each events as e, idx (e.id)}
					{@const label = dayLabel(e)}
					{@const prevLabel = idx > 0 ? dayLabel(events[idx - 1]) : null}
					{#if label !== prevLabel}
						<tr>
							<td
								colspan="4"
								class="bg-base-200 px-4 py-2 text-xs font-semibold tracking-wide uppercase opacity-60"
							>
								{label}
							</td>
						</tr>
					{/if}
					{@const href = resolve(`/staff/events/${e.id}`)}
					<tr class="hover cursor-pointer" use:rowLink={href}>
						<td class="w-px">
							<StatusBadge status={e.status} />
						</td>
						<!-- The day is in the group header, so the cell carries the title
						     and just the time range. -->
						<td class="cell-primary">
							<a {href} class="block truncate font-medium hover:underline">{e.title}</a>
							<div class="text-sm whitespace-nowrap opacity-60">
								{formatTimeRange(e.startsAt, e.endsAt)}
							</div>
						</td>
						<td class="col-support">
							<div class="flex flex-wrap gap-1">
								{#each parseTags(e.tags) as tag (tag)}
									<Badge size="sm" variant="outline">{tag}</Badge>
								{/each}
							</div>
						</td>
						<td class="col-extra w-px">
							{#if e.reservationId}
								<Badge size="sm" variant="info">Reserved</Badge>
							{:else}
								<span class="opacity-40">—</span>
							{/if}
						</td>
					</tr>
				{/each}
			</Table>
		{/snippet}
	</DataList>
</PageContent>
