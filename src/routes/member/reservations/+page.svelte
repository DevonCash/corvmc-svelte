<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import {
		formatDate,
		relativeDay,
		formatTimeRange,
		durationHours,
		formatDurationAmount,
		formatScheduleLabel
	} from '$lib/utils/format';
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import Column from '$lib/components/shared/Table/Column.svelte';
	import Action from '$lib/components/shared/Action.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import DateBlockCard from '$lib/components/shared/DateBlockCard.svelte';
	import FormField from '$lib/components/shared/Form/FormField.svelte';
	import {
		ConfirmReservationAction,
		CancelReservationAction,
		CancelSeriesAction,
		PayReservationAction
	} from '$lib/components/shared/actions';
	import { editMemberSeries } from '$lib/remote/recurring.remote';
	import { getMembershipStatus } from '$lib/remote/reservations.remote';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import ButtonGroup from '$lib/components/shared/ButtonGroup.svelte';
	import { IconClock } from '@tabler/icons-svelte';
	import CreateModal from './CreateModal.svelte';
	import type { MemberReservationsResponse } from '$lib/server/db/schema/api';

	let { data }: { data: MemberReservationsResponse } = $props();

	const upcoming = $derived(data.upcoming);
	const all = $derived(data.all);
	const recurringSeries = $derived(data.recurringSeries);

	let activeTab = $state<'upcoming' | 'all'>('upcoming');
	const tableData = $derived(activeTab === 'upcoming' ? upcoming : all);

	let creditData = $derived(await getMembershipStatus());
	const isSustaining = $derived(creditData.isSustainingMember);

	// Edit series state
	let editDate = $state('');
	let editStartTime = $state('');
	let editEndTime = $state('');
	let editFrequency = $state<'weekly' | 'biweekly' | 'monthly'>('weekly');
</script>

<PageHeader title="Reserve Practice Space">
	<CreateModal />
</PageHeader>
<PageContent>
	<p class="text-sm opacity-60">
		Our practice space is available for $15/hour between 9 AM and 10 PM daily. Reserve anywhere from
		1 to 8 hours at a time with at least one day's notice. Payment is due at the reservation start
		time via cash in person or card online. If you have specific needs for equipment or space, note
		them in the reservation form.
	</p>

	{#if isSustaining}
		<div
			class="flex flex-col gap-1 rounded-lg border border-base-300 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2"
		>
			<div class="flex items-center gap-2">
				<IconClock size={18} class="text-success" />
				<span class="font-medium">{creditData.freeHoursBalance}</span>
				<span class="text-sm opacity-60">free hours remaining</span>
			</div>
			{#if creditData.creditsResetAt}
				<span class="text-sm opacity-60">
					Resets to {creditData.hoursPerReset} on {formatDate(creditData.creditsResetAt)}
				</span>
			{/if}
		</div>
	{:else}
		<div
			class="flex flex-col gap-2 rounded-lg border border-base-300 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3"
		>
			<div class="flex items-center gap-3">
				<IconClock size={18} class="shrink-0 opacity-40" />
				<span>Get free practice hours each month with a sustaining membership.</span>
			</div>
			<a href="/member/membership" class="btn self-end btn-sm sm:self-auto">Learn More</a>
		</div>
	{/if}

	<div class="flex w-full flex-row flex-wrap items-center justify-between gap-2">
		<h2 class="shrink-0 text-2xl font-bold text-nowrap">My Reservations</h2>
		<ButtonGroup
			tabs={[
				{ key: 'upcoming', label: `Active (${upcoming.length})` },
				{ key: 'all', label: 'All' }
			]}
			active={activeTab}
			onchange={(key) => (activeTab = key as 'upcoming' | 'all')}
		/>
	</div>

	<DataTable
		data={tableData}
		empty="No reservations found. Start by creating your first practice space reservation."
		gridClass="grid grid-cols-1 @2xl:grid-cols-2 @5xl:grid-cols-3 gap-3"
	>
		{#snippet card(row)}
			{@const h = durationHours(row.startsAt, row.endsAt)}
			{@const durationLabel = h === 1 ? '1 hr' : `${h} hrs`}
			<DateBlockCard date={row.startsAt}>
				<div class="flex items-center justify-between gap-2">
					<span class="font-semibold">{relativeDay(row.startsAt)}</span>
					<StatusBadge status={row.status} />
				</div>
				<div class="flex items-baseline justify-between gap-2 text-sm">
					<span>{formatTimeRange(row.startsAt, row.endsAt)}</span>
					<span class="text-xs opacity-60">{durationLabel}</span>
				</div>
				<div class="flex items-baseline justify-between gap-2 text-sm">
					<span>{formatDurationAmount(row.startsAt, row.endsAt, 1500)}</span>
					<span class="text-xs opacity-40">
						{#if row.refundedAt}
							Refunded {formatDate(row.refundedAt)}
						{:else if row.status === 'cancelled'}
							Cancelled
						{:else if row.paidAt}
							Paid {formatDate(row.paidAt)}{#if row.paidWithCredits}
								· credits{/if}
						{:else if row.paidWithCredits}
							Paid with credits
						{:else if row.status === 'completed' || row.status === 'no_show'}
							Unpaid
						{:else if new Date(row.startsAt) < new Date()}
							Overdue
						{:else}
							Due {formatDate(row.startsAt)}
						{/if}
					</span>
				</div>
				{#snippet actions()}
					{#if row.status === 'scheduled' || row.status === 'confirmed'}
						<CancelReservationAction reservation={row} class="btn-ghost btn-xs" />
						{#if row.status === 'scheduled'}
							<ConfirmReservationAction reservation={row} class="btn-xs btn-primary" />
						{:else if row.status === 'confirmed' && !row.paidAt && !row.paidWithCredits}
							<PayReservationAction
								reservation={row}
								label="Pay Ahead"
								class="btn-xs btn-primary"
							/>
						{/if}
					{/if}
				{/snippet}
			</DateBlockCard>
		{/snippet}
	</DataTable>

	<div class="flex flex-auto"></div>

	{#if isSustaining}
		<h2 class="pt-4 text-lg font-semibold">My Recurring Reservations</h2>
		<DataTable data={recurringSeries} empty="No active recurring reservations.">
			<Column key="frequencyLabel" header="Pattern">
				{#snippet cell(_value, row)}
					{formatScheduleLabel(row.frequencyLabel, row.startsAt)}
				{/snippet}
			</Column>
			<Column key="startsAt" header="Time">
				{#snippet cell(_value, row)}
					{formatTimeRange(row.startsAt, row.endsAt)}
				{/snippet}
			</Column>
			<Column key="createdAt" header="Start Date" sortable type="date" />
			<Column key="id" header="Status">
				{#snippet cell()}
					<StatusBadge status="active" label />
				{/snippet}
			</Column>
			<Column key="id" header="" shrink stopClick>
				{#snippet cell(_value, row)}
					<div class="flex items-center gap-1">
						<Action
							action={editMemberSeries}
							label="Edit"
							modalTitle="Edit Schedule"
							successToast="Series schedule updated"
							onsuccess={() => invalidateAll()}
							class="btn-xs btn-primary"
						>
							{#snippet trigger({ onclick, disabled, status })}
								<button
									class="btn btn-ghost btn-xs"
									{disabled}
									onclick={() => {
										const start = new Date(row.startsAt);
										const end = new Date(row.endsAt);
										editDate = start.toISOString().slice(0, 10);
										editStartTime = start.toTimeString().slice(0, 5);
										editEndTime = end.toTimeString().slice(0, 5);
										const label = row.frequencyLabel.toLowerCase();
										if (label.includes('2') || label.includes('bi')) editFrequency = 'biweekly';
										else if (label.includes('month')) editFrequency = 'monthly';
										else editFrequency = 'weekly';
										onclick();
									}}
								>
									Edit
								</button>
							{/snippet}
							{#snippet form({ close })}
								<input type="hidden" name="seriesId" value={row.id} />
								<div class="grid grid-cols-3 gap-3">
									<FormField name="date" label="Day" type="date" bind:value={editDate} />
									<FormField
										name="startTime"
										label="Start"
										type="time"
										bind:value={editStartTime}
									/>
									<FormField name="endTime" label="End" type="time" bind:value={editEndTime} />
								</div>
								<FormField name="frequency" label="Frequency">
									<select
										class="select-bordered select w-full"
										name="frequency"
										bind:value={editFrequency}
									>
										<option value="weekly">Weekly</option>
										<option value="biweekly">Every 2 weeks</option>
										<option value="monthly">Monthly</option>
									</select>
								</FormField>
								<p class="text-xs opacity-60">
									This will create a new series with the updated schedule. The current series will
									end.
								</p>
							{/snippet}
						</Action>
						<CancelSeriesAction seriesId={row.id} class="btn-ghost btn-xs" />
					</div>
				{/snippet}
			</Column>
		</DataTable>
	{:else}
		<div class="rounded-lg border border-base-300 px-4 pb-3 text-sm">
			<h2 class="pt-4 text-lg font-semibold">Recurring Reservations</h2>

			<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
				<span
					>Sustaining members can set up recurring weekly, biweekly, or monthly reservations.</span
				>
				<a href="/member/membership" class="btn self-end btn-sm sm:self-auto">Learn More</a>
			</div>
		</div>
	{/if}
</PageContent>
