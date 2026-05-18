<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { formatDate, formatTime, formatDuration } from '$lib/utils/format';
	import TabBar from '$lib/components/shared/TabBar.svelte';
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import Action from '$lib/components/shared/Action.svelte';
	import { confirmReservation, cancelReservation, cancelSeries, editSeries } from './data.remote';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import Badge from '$lib/components/shared/Badge.svelte';
	import type { MemberReservationsResponse } from '$lib/types/api';

	let { data }: { data: MemberReservationsResponse } = $props();

	const upcoming = $derived(data.upcoming);
	const past = $derived(data.past);
	const recurringSeries = $derived(data.recurringSeries);

	let activeTab = $state<'upcoming' | 'past' | 'recurring'>('upcoming');

	const statusBadge: Record<string, string> = {
		scheduled: 'badge-warning',
		confirmed: 'badge-success',
		completed: 'badge-info',
		no_show: 'badge-error',
		cancelled: 'badge-ghost'
	};

	// Edit series state
	let editingSeriesId = $state<string | null>(null);
	let editDate = $state('');
	let editStartTime = $state('');
	let editEndTime = $state('');
	let editFrequency = $state<'weekly' | 'biweekly' | 'monthly'>('weekly');

	function startEditSeries(series: { id: string; startsAt: string; endsAt: string; frequencyLabel: string }) {
		editingSeriesId = series.id;
		const start = new Date(series.startsAt);
		const end = new Date(series.endsAt);
		editDate = start.toISOString().slice(0, 10);
		editStartTime = start.toTimeString().slice(0, 5);
		editEndTime = end.toTimeString().slice(0, 5);
		const label = series.frequencyLabel.toLowerCase();
		if (label.includes('2') || label.includes('bi')) editFrequency = 'biweekly';
		else if (label.includes('month')) editFrequency = 'monthly';
		else editFrequency = 'weekly';
	}
</script>

<PageHeader title="My Reservations">
	<a href="/member/reservations/new" class="btn btn-primary">Book a Session</a>
</PageHeader>
<PageContent>

	<TabBar
		tabs={[
			{ key: 'upcoming', label: `Upcoming (${upcoming.length})` },
			{ key: 'recurring', label: `Recurring (${recurringSeries.length})` },
			{ key: 'past', label: 'Past' }
		]}
		active={activeTab}
		onchange={(key) => (activeTab = key as 'upcoming' | 'past' | 'recurring')}
	/>

	{#if activeTab === 'upcoming'}
		<DataTable data={upcoming} gridClass="grid grid-cols-1 gap-3" empty="No upcoming reservations.">
			{#snippet card(res)}
				<div class="card bg-base-100 shadow-sm">
					<div class="card-body flex-row items-center justify-between py-4">
						<div>
							<p class="font-medium">
								{formatDate(res.startsAt)} &middot; {formatTime(res.startsAt)}–{formatTime(res.endsAt)}
							</p>
							<p class="text-sm opacity-60">
								{formatDuration(res.startsAt, res.endsAt)}
								{#if res.notes} &middot; {res.notes}{/if}
							</p>
						</div>
						<div class="flex items-center gap-2">
							{#if res.recurringSeriesId}
								<Badge variant="outline">recurring</Badge>
							{/if}
							<span class="badge {statusBadge[res.status] ?? ''}">{res.status}</span>
							{#if res.status === 'scheduled'}
								<a href="/member/reservations/{res.id}/pay" class="btn btn-primary btn-sm">
									Pay Now
								</a>
								<Action
									action={() => confirmReservation({ reservationId: res.id })}
									label="Confirm"
									successToast="Reservation confirmed"
									onsuccess={() => invalidateAll()}
									class="btn-success btn-outline btn-sm"
								/>
							{/if}
							{#if res.status === 'scheduled' || res.status === 'confirmed'}
								<Action
									action={() => cancelReservation({ reservationId: res.id })}
									label="Cancel"
									confirm="Cancel this reservation?"
									successToast="Reservation cancelled"
									onsuccess={() => invalidateAll()}
									class="btn-ghost btn-sm"
								/>
							{/if}
						</div>
					</div>
				</div>
			{/snippet}
		</DataTable>
	{/if}

	{#if activeTab === 'recurring'}
		<DataTable data={recurringSeries} gridClass="grid grid-cols-1 gap-3" empty="No active recurring reservations.">
			{#snippet card(series)}
				<div class="card bg-base-100 shadow-sm">
					<div class="card-body py-4">
						<div class="flex items-center justify-between">
							<div>
								<p class="font-medium">
									{formatDate(series.startsAt)} &middot; {formatTime(series.startsAt)}–{formatTime(series.endsAt)}
								</p>
								<p class="text-sm opacity-60">
									{series.frequencyLabel} &middot;
									{formatDuration(series.startsAt, series.endsAt)}
								</p>
							</div>
							<div class="flex items-center gap-2">
								<Badge variant="success" size="md">active</Badge>
								<button class="btn btn-ghost btn-sm" onclick={() => startEditSeries(series)}>Edit</button>
								<Action
									action={() => cancelSeries({ seriesId: series.id })}
									label="Cancel"
									confirm="Cancel this recurring series? Future reservations will not be created."
									successToast="Series cancelled"
									onsuccess={() => invalidateAll()}
									class="btn-ghost btn-sm"
								/>
							</div>
						</div>

						{#if editingSeriesId === series.id}
							<div class="mt-4 pt-4 border-t border-base-200 space-y-3">
								<div class="grid grid-cols-3 gap-3">
									<label class="form-control">
										<div class="label"><span class="label-text">Day</span></div>
										<input type="date" class="input input-bordered input-sm" bind:value={editDate} />
									</label>
									<label class="form-control">
										<div class="label"><span class="label-text">Start</span></div>
										<input type="time" class="input input-bordered input-sm" bind:value={editStartTime} />
									</label>
									<label class="form-control">
										<div class="label"><span class="label-text">End</span></div>
										<input type="time" class="input input-bordered input-sm" bind:value={editEndTime} />
									</label>
								</div>
								<label class="form-control">
									<div class="label"><span class="label-text">Frequency</span></div>
									<select class="select select-bordered select-sm" bind:value={editFrequency}>
										<option value="weekly">Weekly</option>
										<option value="biweekly">Every 2 weeks</option>
										<option value="monthly">Monthly</option>
									</select>
								</label>
								<p class="text-xs opacity-60">This will create a new series with the updated schedule. The current series will end.</p>
								<div class="flex justify-end gap-2">
									<button class="btn btn-ghost btn-sm" onclick={() => (editingSeriesId = null)}>Cancel</button>
									<Action
										action={() => {
											const result = editSeries({
												seriesId: series.id,
												date: editDate,
												startTime: editStartTime,
												endTime: editEndTime,
												frequency: editFrequency
											});
											editingSeriesId = null;
											return result;
										}}
										label="Update Schedule"
										successToast="Series schedule updated"
										onsuccess={() => invalidateAll()}
										class="btn-primary btn-sm"
									/>
								</div>
							</div>
						{/if}
					</div>
				</div>
			{/snippet}
		</DataTable>
	{/if}

	{#if activeTab === 'past'}
		<DataTable data={past} gridClass="grid grid-cols-1 gap-3" empty="No past reservations.">
			{#snippet card(res)}
				<div class="card bg-base-100 shadow-sm">
					<div class="card-body flex-row items-center justify-between py-4">
						<div>
							<p class="font-medium">
								{formatDate(res.startsAt)} &middot; {formatTime(res.startsAt)}–{formatTime(res.endsAt)}
							</p>
							<p class="text-sm opacity-60">{formatDuration(res.startsAt, res.endsAt)}</p>
						</div>
						<span class="badge {statusBadge[res.status] ?? ''}">{res.status}</span>
					</div>
				</div>
			{/snippet}
		</DataTable>
	{/if}
</PageContent>
