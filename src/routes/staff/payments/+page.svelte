<script lang="ts">
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import Column from '$lib/components/shared/Table/Column.svelte';
	import MemberColumn from '$lib/components/shared/Table/MemberColumn.svelte';
	import * as Filter from '$lib/components/shared/Table/Filter';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import Pagination from '$lib/components/shared/Pagination.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import PaymentMethodIcon from '$lib/components/shared/PaymentMethodIcon.svelte';
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

<PageHeader title="Payments" />
<PageContent>

	<DataTable data={data.payments} clearHref="/staff/payments" empty="No payment records found">
		{#snippet toolbar()}
			<Filter.Search name="q" value={data.filters.search} placeholder="Search name or email..." />
			<Filter.Select name="method" value={data.filters.method} placeholder="All methods"
				options={[['Cash', 'Cash'], ['Credits', 'Credits']]} />
			<Filter.Select name="status" value={data.filters.status} placeholder="All statuses"
				options={[['completed', 'Completed'], ['refunded', 'Refunded']]} />
			<Filter.Date name="from" value={data.filters.from} />
			<Filter.Date name="to" value={data.filters.to} />
		{/snippet}
		<Column key="paidAt" header="Date" sortable type="datetime" />
		<MemberColumn nameKey="userName" emailKey="userEmail" userIdKey="userId" />
		<Column key="amountCents" header="Amount" sortable type="currency" />
		<Column key="paymentMethod" header="Method" shrink>
			{#snippet cell(_, p: Payment)}
				<PaymentMethodIcon method={p.paymentMethod} />
			{/snippet}
		</Column>
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
</PageContent>
