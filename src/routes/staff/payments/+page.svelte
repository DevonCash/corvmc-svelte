<script lang="ts">
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import Column from '$lib/components/shared/Table/Column.svelte';
	import MemberColumn from '$lib/components/shared/Table/MemberColumn.svelte';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import Pagination from '$lib/components/shared/Pagination.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import CopyableId from '$lib/components/shared/CopyableId.svelte';
	import type { StaffPaymentsResponse } from '$lib/types/api';

	let { data }: { data: StaffPaymentsResponse } = $props();

	type Payment = (typeof data.payments)[number];

	function buildPageHref(page: number): string {
		const params = new URLSearchParams();
		if (data.filters.search) params.set('q', data.filters.search);
		if (data.filters.method) params.set('method', data.filters.method);
		if (data.filters.status) params.set('status', data.filters.status);
		if (data.filters.from) params.set('from', data.filters.from);
		if (data.filters.to) params.set('to', data.filters.to);
		params.set('page', String(page));
		return `/staff/payments?${params.toString()}`;
	}
</script>

<div class="space-y-6">
	<PageHeader title="Payments" />

	<!-- Filters -->
	<form method="get" class="flex flex-wrap items-end gap-2">
		<input
			type="text"
			name="q"
			value={data.filters.search}
			placeholder="Search name or email..."
			class="input-bordered input input-sm w-48"
		/>
		<select name="method" class="select-bordered select select-sm">
			<option value="">All methods</option>
			<option value="Cash" selected={data.filters.method === 'Cash'}>Cash</option>
			<option value="Credits" selected={data.filters.method === 'Credits'}>Credits</option>
		</select>
		<select name="status" class="select-bordered select select-sm">
			<option value="">All statuses</option>
			<option value="completed" selected={data.filters.status === 'completed'}>Completed</option>
			<option value="refunded" selected={data.filters.status === 'refunded'}>Refunded</option>
		</select>
		<input
			type="date"
			name="from"
			value={data.filters.from}
			class="input-bordered input input-sm"
		/>
		<input
			type="date"
			name="to"
			value={data.filters.to}
			class="input-bordered input input-sm"
		/>
		<button type="submit" class="btn btn-sm btn-primary">Filter</button>
		{#if data.filters.search || data.filters.method || data.filters.status || data.filters.from || data.filters.to}
			<a href="/staff/payments" class="btn btn-ghost btn-sm">Clear</a>
		{/if}
	</form>

	<!-- Table -->
	<DataTable data={data.payments} empty="No payment records found">
		<Column key="paidAt" header="Date" sortable type="datetime" />
		<MemberColumn nameKey="userName" emailKey="userEmail" userIdKey="userId" />
		<Column key="amountCents" header="Amount" sortable type="currency" />
		<Column key="paymentMethod" header="Method" type="badge" />
		<Column key="status" header="Status">
			{#snippet cell(_, p: Payment)}
				<StatusBadge status={p.status} />
			{/snippet}
		</Column>
		<Column key="id" header="Record">
			{#snippet cell(_, p: Payment)}
				<div class="flex items-center gap-2">
					<CopyableId value={p.id} label="Stripe" />
					{#if p.reservationId}
						<a href="/staff/reservations/{p.reservationId}" class="btn btn-ghost btn-xs">
							View reservation
						</a>
					{/if}
				</div>
			{/snippet}
		</Column>
	</DataTable>

	<Pagination page={data.page} totalPages={data.totalPages} buildHref={buildPageHref} />
</div>
