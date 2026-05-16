<script lang="ts">
	import type { Column } from '$lib/components/shared/Table/DataTable.svelte';
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import * as Filter from '$lib/components/shared/Table/Filter';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import BookerTypeIcon from '$lib/components/shared/BookerTypeIcon.svelte';
	import ResolveModal from './ResolveModal.svelte';
	import CreateReservation from './CreateModal.svelte';
	import MemberLink from '$lib/components/shared/MemberLink.svelte';
	import TabBar from '$lib/components/shared/TabBar.svelte';
	import { IconCheck, IconClock, IconGift, IconArrowBackUp, IconUserX, IconCircleX, IconRepeat } from '@tabler/icons-svelte';
	import { formatDate, formatTimeRange, formatDurationAmount } from '$lib/utils/format';
	import type { StaffReservationsResponse } from '$lib/types/api';

	let { data }: { data: StaffReservationsResponse } = $props();

	type Reservation = (typeof data.reservations)[number];

	let resolveOpen = $state(false);

	function paymentStatus(r: Reservation): { label: string; color: string; icon: typeof IconCheck } {
		if (r.status === 'no_show') return { label: 'No-show', color: 'text-error', icon: IconUserX };
		if (r.status === 'cancelled') {
			return r.stripePaymentRecordId
				? { label: 'Refunded', color: 'text-error', icon: IconArrowBackUp }
				: { label: 'Cancelled', color: 'text-base-content', icon: IconCircleX };
		}
		if (r.status === 'scheduled') return { label: 'Unpaid', color: 'text-warning', icon: IconClock };
		// confirmed or completed
		return r.stripePaymentRecordId
			? { label: 'Paid', color: 'text-success', icon: IconCheck }
			: { label: 'Comped', color: 'text-info', icon: IconGift };
	}

	function dayLabel(r: Reservation): string {
		const localDate = new Date(r.startsAt).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
		const now = new Date();
		const today = now.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
		const tomorrow = new Date(now.getTime() + 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
		const label = formatDate(r.startsAt);
		if (localDate === today) return `${label} (Today)`;
		if (localDate === tomorrow) return `${label} (Tomorrow)`;
		return label;
	}

	const columns: Column<Reservation>[] = [
		{ key: 'status', header: '' },
		{ key: 'startsAt', header: 'Time', sortable: true },
		{ key: 'memberName', header: 'Reserved for', sortable: true },
		{ key: 'stripePaymentRecordId', header: 'Payment' }
	];
</script>

<PageHeader title="Reservations">
		<div class="flex gap-2">
			<button
				class="btn btn-sm {data.counts.unresolved > 0 ? 'btn-warning' : 'btn-ghost'}"
				onclick={() => (resolveOpen = true)}
			>
				Resolve
				{#if data.counts.unresolved > 0}
					<span class="badge badge-sm">{data.counts.unresolved}</span>
				{/if}
			</button>
			<CreateReservation />
		</div>
	</PageHeader>
<PageContent>
	<TabBar
		tabs={[
			{
				key: 'upcoming',
				label: 'Upcoming',
				badge: data.counts.upcoming,
				href: '/staff/reservations?tab=upcoming'
			},
			{ key: 'all', label: 'All', badge: data.counts.all, href: '/staff/reservations?tab=all' }
		]}
		active={data.tab}
	/>

	<DataTable data={data.reservations} {columns} groupBy={dayLabel} clearHref="/staff/reservations?tab={data.tab}" empty="No reservations found">
		{#snippet toolbar()}
			<input type="hidden" name="tab" value={data.tab} />
			<Filter.Search name="q" value={data.search} placeholder="Search name or email..." />
			<Filter.Date name="from" value={data.dateFrom ?? ''} />
			<Filter.Date name="to" value={data.dateTo ?? ''} />
		{/snippet}
		{#snippet row(r)}
			<tr
				class="hover cursor-pointer"
				onclick={() => (window.location.href = `/staff/reservations/${r.id}`)}
			>
				<td class="w-px">
					<StatusBadge status={r.status} class='size-6'/>
				</td>
				<td>
					<div class="flex items-center gap-1">
						{formatTimeRange(r.startsAt, r.endsAt)}
						{#if r.recurringSeriesId}
							<span class="tooltip" data-tip="Recurring">
								<IconRepeat size={14} class="text-base-content" />
							</span>
						{/if}
					</div>
					<div class="text-sm opacity-60">{formatDate(r.startsAt)}</div>
				</td>
				<td class="w-px" onclick={(e) => e.stopPropagation()} style='padding-inline: 0;'>
					<div class="flex items-center gap-1">
						{#if r.bookerType !== 'user'}
							<span class="tooltip" data-tip={r.bookerType}>
								<BookerTypeIcon type={r.bookerType} size={16} />
							</span>
						{/if}
						<MemberLink name={r.memberName} email={r.memberEmail} pronouns={r.memberPronouns} userId={r.createdByUserId} class='p-7 px-4'/>
					</div>
				</td>
				<td>
					{#if r.bookerType === 'event'}
						<span class="text-sm opacity-40">—</span>
					{:else}
						{@const ps = paymentStatus(r)}
						<div class="flex items-center gap-1">
							{formatDurationAmount(r.startsAt, r.endsAt, data.hourlyRateCents)}
							<span class="tooltip" data-tip={ps.label}>
								<ps.icon size={16} class={ps.color} />
							</span>
						</div>
					{/if}
				</td>
			</tr>
		{/snippet}
	</DataTable>
</PageContent>

<ResolveModal
	bind:open={resolveOpen}
	unresolved={data.unresolved}
	hourlyRateCents={data.hourlyRateCents}
/>
