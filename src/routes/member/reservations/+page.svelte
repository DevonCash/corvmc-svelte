<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { formatDate, formatTime, formatDuration } from '$lib/utils/format';
	import TabBar from '$lib/components/shared/TabBar.svelte';
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import Action from '$lib/components/shared/Action.svelte';
	import { cancelReservation, cancelSeries } from './data.remote';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
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
								<span class="badge badge-outline badge-sm">recurring</span>
							{/if}
							<span class="badge {statusBadge[res.status] ?? ''}">{res.status}</span>
							{#if res.status === 'scheduled'}
								<a href="/member/reservations/{res.id}/pay" class="btn btn-primary btn-sm">
									Pay Now
								</a>
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
					<div class="card-body flex-row items-center justify-between py-4">
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
							<span class="badge badge-success">active</span>
							<Action
								action={() => cancelSeries({ seriesId: series.id })}
								label="Cancel Series"
								confirm="Cancel this recurring series? Future reservations will not be created."
								successToast="Series cancelled"
								onsuccess={() => invalidateAll()}
								class="btn-ghost btn-sm"
							/>
						</div>
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
