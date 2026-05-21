<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import {
		formatDateYear,
		formatDate,
		relativeDay,
		formatTimeRange,
		formatDurationAndAmount,
		formatScheduleLabel
	} from '$lib/utils/format';
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import Column from '$lib/components/shared/Table/Column.svelte';
	import Action from '$lib/components/shared/Action.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import FormField from '$lib/components/shared/Form/FormField.svelte';
	import {
		ConfirmReservationAction,
		CancelReservationAction,
		CancelSeriesAction
	} from '$lib/components/shared/actions';
	import { editMemberSeries } from '$lib/remote/recurring.remote';
	import { getMembershipStatus } from '$lib/remote/reservations.remote';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import ButtonGroup from '$lib/components/shared/ButtonGroup.svelte';
	import { IconClock } from '@tabler/icons-svelte';
	import CreateModal from './CreateModal.svelte';
	import type { MemberReservationsResponse } from '$lib/server/db/schema/api';

	let { data }: { data: MemberReservationsResponse } = $props();

	const upcoming = $derived(data.upcoming);
	const past = $derived(data.past);
	const recurringSeries = $derived(data.recurringSeries);

	const allReservations = $derived(
		[...upcoming, ...past].sort(
			(a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()
		)
	);

	let activeTab = $state<'upcoming' | 'all'>('upcoming');
	const tableData = $derived(activeTab === 'upcoming' ? upcoming : allReservations);

	let creditData = $derived(await getMembershipStatus());
	const isSustaining = $derived(creditData.isSustainingMember);

	const statusBorder: Record<string, string> = {
		scheduled: 'border-l-warning',
		confirmed: 'border-l-info',
		completed: 'border-l-success',
		no_show: 'border-l-error',
		cancelled: 'border-l-base-300'
	};

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
		<div class="flex flex-col gap-1 rounded-lg border border-base-300 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
			<div class="flex items-center gap-2">
				<IconClock size={18} class="text-success" />
				<span class="font-medium">{creditData.freeHoursBalance}</span>
				<span class="text-sm opacity-60">free hours remaining</span>
			</div>
			<span class="text-sm opacity-60">
				{creditData.hoursGrantedPerMonth} hours granted per month
			</span>
		</div>
	{:else}
		<div
			class="flex flex-col gap-2 rounded-lg border border-base-300 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3"
		>
			<div class="flex items-center gap-3">
				<IconClock size={18} class="shrink-0 opacity-40" />
				<span>Get free practice hours each month with a sustaining membership.</span>
			</div>
			<a href="/member/membership" class="btn btn-sm self-end sm:self-auto">Learn More</a>
		</div>
	{/if}

	<div class="flex w-full gap-2 flex-row flex-wrap items-center justify-between">
		<h2 class="text-2xl font-bold text-nowrap shrink-0">My Reservations</h2>
		<ButtonGroup
			tabs={[
				{ key: 'upcoming', label: `Upcoming (${upcoming.length})` },
				{ key: 'all', label: 'All' }
			]}
			active={activeTab}
			onchange={(key) => (activeTab = key as 'upcoming' | 'all')}
		/>
	</div>

	<!-- Mobile: card layout -->
	{#if tableData.length === 0}
		<p class="py-8 text-center opacity-60 sm:hidden">No reservations found. Start by creating your first practice space reservation.</p>
	{:else}
		<div class="grid grid-cols-1 gap-3 sm:hidden">
			{#each tableData as row (row.id)}
				<div class="card bg-base-100 shadow-sm border-l-4 {statusBorder[row.status] ?? 'border-l-base-300'}">
					<div class="card-body gap-1 px-4 py-3">
						<div class="flex items-center justify-between gap-2">
							<p class="font-medium">{formatDateYear(row.startsAt)}</p>
							<StatusBadge status={row.status} label />
						</div>
						<div class="flex items-baseline justify-between gap-2 text-sm">
							<span>{formatTimeRange(row.startsAt, row.endsAt)}</span>
							<span>{formatDurationAndAmount(row.startsAt, row.endsAt, 1500)}</span>
						</div>
						<div class="flex items-baseline justify-between gap-2 text-xs opacity-40">
							<span>{relativeDay(row.startsAt)}</span>
							<span>
								{#if row.status === 'cancelled'}
									Cancelled
								{:else if row.paidAt}
									Paid {formatDate(row.paidAt)}{#if row.paidWithCredits} · credits{/if}
								{:else if row.paidWithCredits}
									Paid with credits
								{:else if new Date(row.startsAt) < new Date()}
									Overdue
								{:else}
									Due {formatDate(row.startsAt)}
								{/if}
							</span>
						</div>
						{#if row.status === 'scheduled' || row.status === 'confirmed'}
							<div class="-mx-4 -mb-3 mt-2 flex items-center justify-end gap-1 rounded-b-[var(--radius-box)] bg-base-200/50">
								{#if row.status === 'scheduled'}
									<a href="/member/reservations/{row.id}/pay" class="btn btn-xs btn-primary">Pay Now</a>
									<ConfirmReservationAction reservation={row} class="btn-outline btn-xs btn-success" />
								{/if}
								<CancelReservationAction reservation={row} class="btn-ghost btn-xs" />
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Desktop: table layout -->
	<div class="hidden sm:block">
		<DataTable
			data={tableData}
			empty="No reservations found. Start by creating your first practice space reservation."
		>
			<Column key="startsAt" header="Date" sortable>
				{#snippet cell(_value, row)}
					<div>
						<span>{formatDateYear(row.startsAt)}</span>
						<p class="text-xs opacity-50">{relativeDay(row.startsAt)}</p>
					</div>
				{/snippet}
			</Column>
			<Column key="startsAt" header="Time">
				{#snippet cell(_value, row)}
					{formatTimeRange(row.startsAt, row.endsAt)}
				{/snippet}
			</Column>
			<Column key="startsAt" header="Price">
				{#snippet cell(_value, row)}
					<div>
						<span>{formatDurationAndAmount(row.startsAt, row.endsAt, 1500)}</span>
						<p class="text-xs opacity-50">
							{#if row.status === 'cancelled'}
								Cancelled
							{:else if row.paidAt}
								Paid {formatDate(row.paidAt)}{#if row.paidWithCredits}
									· credits{/if}
							{:else if row.paidWithCredits}
								Paid with credits
							{:else if new Date(row.startsAt) < new Date()}
								Overdue
							{:else}
								Due {formatDate(row.startsAt)}
							{/if}
						</p>
					</div>
				{/snippet}
			</Column>
			<Column key="status" header="Status">
				{#snippet cell(_value, row)}
					<StatusBadge status={row.status} label />
				{/snippet}
			</Column>
			<Column key="id" header="" shrink stopClick>
				{#snippet cell(_value, row)}
					<div class="flex items-center gap-1">
						{#if row.status === 'scheduled'}
							<a href="/member/reservations/{row.id}/pay" class="btn btn-xs btn-primary"> Pay Now </a>
							<ConfirmReservationAction reservation={row} class="btn-outline btn-xs btn-success" />
						{/if}
						{#if row.status === 'scheduled' || row.status === 'confirmed'}
							<CancelReservationAction reservation={row} class="btn-ghost btn-xs" />
						{/if}
					</div>
				{/snippet}
			</Column>
		</DataTable>
	</div>

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
				<span>Sustaining members can set up recurring weekly, biweekly, or monthly reservations.</span>
				<a href="/member/membership" class="btn btn-sm self-end sm:self-auto">Learn More</a>
			</div>
		</div>
	{/if}
</PageContent>
