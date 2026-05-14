<script lang="ts">
	import type { PageServerData } from './$types';
	import type { Column } from '$lib/components/DataTable.svelte';
	import DataTable from '$lib/components/DataTable.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import ResolveModal from './ResolveModal.svelte';
	import CreateModal from './CreateModal.svelte';

	let { data }: { data: PageServerData } = $props();

	type Reservation = (typeof data.reservations)[number];

	let resolveOpen = $state(false);
	let createOpen = $state(false);

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-US', {
			timeZone: 'America/Los_Angeles',
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
	}

	function formatTimeRange(startsAt: string, endsAt: string): string {
		const fmt = (iso: string) =>
			new Date(iso).toLocaleTimeString('en-US', {
				timeZone: 'America/Los_Angeles',
				hour: 'numeric',
				minute: '2-digit'
			});
		return `${fmt(startsAt)} – ${fmt(endsAt)}`;
	}

	function formatAmount(startsAt: string, endsAt: string): string {
		const ms = new Date(endsAt).getTime() - new Date(startsAt).getTime();
		const hours = ms / (1000 * 60 * 60);
		const cents = Math.round(hours * data.hourlyRateCents);
		return `$${(cents / 100).toFixed(2)}`;
	}

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
		return new Date(r.startsAt).toLocaleDateString('en-US', {
			timeZone: 'America/Los_Angeles',
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
	}

	const columns: Column<Reservation>[] = [
		{ key: 'status', header: '' },
		{ key: 'memberName', header: 'Member', sortable: true },
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
			<button class="btn btn-sm btn-primary" onclick={() => (createOpen = true)}>
				New Reservation
			</button>
		</div>
	</PageHeader>

	<!-- Tabs -->
	<div class="tabs-bordered tabs">
		<a
			href="/staff/reservations?tab=upcoming"
			class="tab"
			class:tab-active={data.tab === 'upcoming'}
		>
			Upcoming
			<span class="ml-1 badge badge-sm">{data.counts.upcoming}</span>
		</a>
		<a href="/staff/reservations?tab=all" class="tab" class:tab-active={data.tab === 'all'}>
			All
			<span class="ml-1 badge badge-sm">{data.counts.all}</span>
		</a>
	</div>

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
					<StatusBadge status={r.status} />
				</td>
				<td class="w-px">
					<a
						href="/staff/users/{r.createdByUserId}"
						class="link link-primary"
						onclick={(e) => e.stopPropagation()}
					>
						{r.memberName}
					</a>
					<div class="text-sm opacity-60">{r.memberEmail}</div>
				</td>
				<td class="w-full">
					<div>{formatTimeRange(r.startsAt, r.endsAt)}</div>
					<div class="text-sm opacity-60">{formatDate(r.startsAt)}</div>
				</td>

				<td>
					{#if r.bookerType === 'event'}
						<span class="text-sm opacity-40">—</span>
					{:else}
						<div>{formatAmount(r.startsAt, r.endsAt)}</div>
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
<CreateModal bind:open={createOpen} />
