<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import Column from '$lib/components/shared/Table/Column.svelte';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import MemberLink from '$lib/components/shared/MemberLink.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Action from '$lib/components/shared/Action.svelte';
	import { IconRepeat } from '@tabler/icons-svelte';
	import { formatTimeRange, formatDuration, formatScheduleLabel, formatMonthDayYear } from '$lib/utils/format';
	import { cancelStaffSeries } from '$lib/remote/recurring.remote';
	import type { StaffRecurringResponse } from '$lib/server/db/schema/api';

	let { data }: { data: StaffRecurringResponse } = $props();

	function buildPageHref(page: number): string {
		const params = new URLSearchParams();
		if (data.filter) params.set('filter', data.filter);
		params.set('page', String(page));
		return `/staff/recurring?${params.toString()}`;
	}
</script>

<PageHeader title="Recurring Reservations" />
<PageContent>

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

	<DataTable data={data.series} rowHref={(s) => `/staff/recurring/${s.id}`} empty="No recurring series found"
		pagination={{ page: data.pagination.page, totalPages: data.pagination.totalPages }} {buildPageHref}>
		<Column key="userName" header="Member" stopClick>
			{#snippet cell(_, s)}
				<MemberLink member={{ name: s.userName, pronouns: s.userPronouns, role: s.userRole }} />
			{/snippet}
		</Column>
		<Column key="frequencyLabel" header="Schedule">
			{#snippet cell(_, s)}
				<div class="flex items-center gap-1">
					<IconRepeat size={14} class="opacity-60 shrink-0" />
					{formatScheduleLabel(s.frequencyLabel, s.startsAt)}
				</div>
				<div class="text-sm opacity-60">
					{formatTimeRange(s.startsAt, s.endsAt)}
					<span class="mx-1">·</span>
					{formatDuration(s.startsAt, s.endsAt)}
				</div>
			{/snippet}
		</Column>
		<Column key="startsAt" header="Starts" type="date" sortable shrink>
			{#snippet cell(_, s)}
				{formatMonthDayYear(s.startsAt)}
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
						action={cancelStaffSeries}
						label="Cancel"
						modalTitle="Confirm"
						successToast="Series cancelled"
						onsuccess={() => invalidateAll()}
						class="btn-ghost btn-xs text-error"
					>
						{#snippet form({ close })}
							<input type="hidden" name="seriesId" value={s.id} />
							<p class="py-4">Cancel this recurring series? Future reservations will not be created.</p>
						{/snippet}
					</Action>
				{/if}
			{/snippet}
		</Column>
	</DataTable>
</PageContent>
