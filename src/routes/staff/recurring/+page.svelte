<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import Column from '$lib/components/shared/Table/Column.svelte';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import MemberLink from '$lib/components/shared/MemberLink.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import BookerTypeIcon from '$lib/components/shared/BookerTypeIcon.svelte';
	import Action from '$lib/components/shared/Action.svelte';
	import { IconRepeat } from '@tabler/icons-svelte';
	import { formatDate, formatTimeRange, formatDuration } from '$lib/utils/format';
	import { cancelSeries } from './data.remote';
	import type { StaffRecurringResponse } from '$lib/types/api';

	let { data }: { data: StaffRecurringResponse } = $props();
</script>

<div class="space-y-6">
	<PageHeader title="Recurring Reservations" />

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

	<DataTable data={data.series} empty="No recurring series found">
		<Column key="userName" header="Member" stopClick>
			{#snippet cell(_, s)}
				<MemberLink name={s.userName} userId={undefined} />
			{/snippet}
		</Column>
		<Column key="startsAt" header="Day / Time" sortable>
			{#snippet cell(_, s)}
				<div>{formatDate(s.startsAt)}</div>
				<div class="text-sm opacity-60">
					{formatTimeRange(s.startsAt, s.endsAt)}
					<span class="mx-1">·</span>
					{formatDuration(s.startsAt, s.endsAt)}
				</div>
			{/snippet}
		</Column>
		<Column key="frequencyLabel" header="Frequency" shrink>
			{#snippet cell(_, s)}
				<span class="badge badge-outline badge-sm gap-1">
					<IconRepeat size={12} />
					{s.frequencyLabel}
				</span>
			{/snippet}
		</Column>
		<Column key="bookerType" header="Booker" shrink>
			{#snippet cell(_, s)}
				<span class="tooltip" data-tip={s.bookerType}>
					<BookerTypeIcon type={s.bookerType} size={16} />
				</span>
			{/snippet}
		</Column>
		<Column key="createdAt" header="Created" type="date" sortable shrink />
		<Column key="cancelledAt" header="Status" shrink>
			{#snippet cell(_, s)}
				{#if s.cancelledAt}
					<StatusBadge status="cancelled" />
				{:else}
					<StatusBadge status="active" />
				{/if}
			{/snippet}
		</Column>
		<Column key="id" header="" shrink stopClick>
			{#snippet cell(_, s)}
				{#if !s.cancelledAt}
					<Action
						action={() => cancelSeries({ seriesId: s.id })}
						label="Cancel"
						confirm="Cancel this recurring series? Future reservations will not be created."
						successToast="Series cancelled"
						onsuccess={() => invalidateAll()}
						class="btn-ghost btn-xs text-error"
					/>
				{/if}
			{/snippet}
		</Column>
	</DataTable>
</div>
