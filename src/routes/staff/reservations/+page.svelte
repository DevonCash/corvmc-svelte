<script lang="ts">
	import type { PageServerData } from './$types';
	import type { Column } from '$lib/components/shared/Table/DataTable.svelte';
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import ResolveModal from './ResolveModal.svelte';
	import CreateModal from './CreateModal.svelte';
	import MemberLink from '$lib/components/shared/MemberLink.svelte';
	import TabBar from '$lib/components/shared/TabBar.svelte';
	import { formatDate, formatTimeRange, formatDurationAmount } from '$lib/utils/format';

	let { data }: { data: PageServerData } = $props();

	type Reservation = (typeof data.reservations)[number];

	let resolveOpen = $state(false);

	function paymentStatus(r: Reservation): { label: string; class: string } {
		if (r.status === 'no_show') return { label: 'No-show', class: 'badge-error' };
		if (r.status === 'cancelled') {
			return r.stripePaymentRecordId
				? { label: 'Refunded', class: 'badge-error' }
				: { label: 'Cancelled', class: 'badge-ghost' };
		}
		if (r.status === 'scheduled') return { label: 'Unpaid', class: 'badge-warning' };
		// confirmed or completed
		return r.stripePaymentRecordId
			? { label: 'Paid', class: 'badge-success' }
			: { label: 'Comped', class: 'badge-info' };
	}

	function dayLabel(r: Reservation): string {
		return formatDate(r.startsAt);
	}

	const columns: Column<Reservation>[] = [
		{ key: 'status', header: '' },
		{ key: 'memberName', header: 'Reserved for', sortable: true },
		{ key: 'startsAt', header: 'Time', sortable: true },
		{ key: 'stripePaymentRecordId', header: 'Payment' },
		{ key: 'bookerType', header: 'Booker' }
	];
</script>

<div class="space-y-6">
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
			
		</div>
	</PageHeader>

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

	<!-- Filters -->
	<form method="get" class="flex flex-wrap items-end gap-2">
		<input type="hidden" name="tab" value={data.tab} />
		<input
			type="text"
			name="q"
			value={data.search}
			placeholder="Search name or email..."
			class="input-bordered input input-sm w-48"
		/>
		<input
			type="date"
			name="from"
			value={data.dateFrom ?? ''}
			class="input-bordered input input-sm"
		/>
		<input type="date" name="to" value={data.dateTo ?? ''} class="input-bordered input input-sm" />
		<button type="submit" class="btn btn-sm btn-primary">Filter</button>
		{#if data.search || data.dateFrom || data.dateTo || data.statusFilter.length > 0}
			<a href="/staff/reservations?tab={data.tab}" class="btn btn-ghost btn-sm">Clear</a>
		{/if}
	</form>

	<!-- Table -->
	<DataTable data={data.reservations} {columns} groupBy={dayLabel} empty="No reservations found">
		{#snippet row(r)}
			<tr
				class="hover cursor-pointer"
				onclick={() => (window.location.href = `/staff/reservations/${r.id}`)}
			>
				<td class="w-px">
					<StatusBadge status={r.status} class='size-6'/>
				</td>
				<td class="w-px" onclick={(e) => e.stopPropagation()} style='padding-inline: 0;'>
					<MemberLink name={r.memberName} email={r.memberEmail} userId={r.createdByUserId} class='p-7 px-4'/>
				</td>
				<td class="w-full">
					<div>{formatTimeRange(r.startsAt, r.endsAt)}</div>
					<div class="text-sm opacity-60">{formatDate(r.startsAt)}</div>
				</td>

				<td>
					{#if r.bookerType === 'event'}
						<span class="text-sm opacity-40">—</span>
					{:else}
						<div>{formatDurationAmount(r.startsAt, r.endsAt, data.hourlyRateCents)}</div>
						{@const ps = paymentStatus(r)}
						<span class="badge badge-sm {ps.class}">{ps.label}</span>
					{/if}
				</td>
				<td>
					<span class="badge badge-outline badge-sm">{r.bookerType}</span>
				</td>
			</tr>
		{/snippet}
	</DataTable>
</div>

<ResolveModal
	bind:open={resolveOpen}
	unresolved={data.unresolved}
	hourlyRateCents={data.hourlyRateCents}
/>
<CreateModal />
