<script lang="ts">
	import type { Column } from '$lib/components/shared/Table/DataTable.svelte';
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import MemberLink from '$lib/components/shared/MemberLink.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import { formatDate, formatTimeRange, formatDuration } from '$lib/utils/format';

	let { data }: { data: any } = $props();

	type Series = (typeof data.series)[number];

	const columns: Column<Series>[] = [
		{ key: 'userName', header: 'Member' },
		{ key: 'startsAt', header: 'Day / Time', sortable: true },
		{ key: 'frequencyLabel', header: 'Frequency' },
		{ key: 'bookerType', header: 'Booker' },
		{ key: 'createdAt', header: 'Created', sortable: true },
		{ key: 'cancelledAt', header: 'Status' },
		{ key: 'id', header: '' }
	];
</script>

<div class="space-y-6">
	<PageHeader title="Recurring Reservations" />

	<!-- Filters -->
	<div class="flex items-center gap-2">
		<a
			href="/staff/recurring?filter=active"
			class="btn btn-sm"
			class:btn-primary={data.filter === 'active'}
			class:btn-ghost={data.filter !== 'active'}
		>
			Active
		</a>
		<a
			href="/staff/recurring?filter=cancelled"
			class="btn btn-sm"
			class:btn-primary={data.filter === 'cancelled'}
			class:btn-ghost={data.filter !== 'cancelled'}
		>
			Cancelled
		</a>
		<a
			href="/staff/recurring?filter=all"
			class="btn btn-sm"
			class:btn-primary={data.filter === 'all'}
			class:btn-ghost={data.filter !== 'all'}
		>
			All
		</a>
	</div>

	<!-- Table -->
	<DataTable data={data.series} {columns} empty="No recurring series found">
		{#snippet row(s)}
			<tr class="hover">
				<td onclick={(e) => e.stopPropagation()} style="padding-inline: 0;">
					<MemberLink name={s.userName} userId={undefined} class="p-7 px-4" />
				</td>
				<td>
					<div>{formatDate(s.startsAt)}</div>
					<div class="text-sm opacity-60">
						{formatTimeRange(s.startsAt, s.endsAt)}
						<span class="mx-1">·</span>
						{formatDuration(s.startsAt, s.endsAt)}
					</div>
				</td>
				<td>
					<span class="badge badge-outline badge-sm">{s.frequencyLabel}</span>
				</td>
				<td>
					<span class="badge badge-outline badge-sm">{s.bookerType}</span>
				</td>
				<td>{formatDate(s.createdAt)}</td>
				<td>
					{#if s.cancelledAt}
						<StatusBadge status="cancelled" />
					{:else}
						<StatusBadge status="active" />
					{/if}
				</td>
				<td>
					{#if !s.cancelledAt}
						<form method="post" action="?/cancel">
							<input type="hidden" name="seriesId" value={s.id} />
							<button type="submit" class="btn btn-ghost btn-xs text-error">Cancel</button>
						</form>
					{/if}
				</td>
			</tr>
		{/snippet}
	</DataTable>
</div>
