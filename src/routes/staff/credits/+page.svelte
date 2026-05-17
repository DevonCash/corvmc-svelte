<script lang="ts">
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import Column from '$lib/components/shared/Table/Column.svelte';
	import MemberColumn from '$lib/components/shared/Table/MemberColumn.svelte';
	import * as Filter from '$lib/components/shared/Table/Filter';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import Pagination from '$lib/components/shared/Pagination.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import type { StaffCreditsResponse } from '$lib/types/api';

	let { data }: { data: StaffCreditsResponse } = $props();

	type Transaction = (typeof data.transactions)[number];

	const sourceLabels: Record<string, string> = {
		monthly_allocation: 'Monthly Allocation',
		checkout: 'Checkout',
		refund: 'Refund',
		cancelled: 'Cancelled',
		admin_adjustment: 'Admin Adjustment'
	};

	function buildPageHref(page: number): string {
		const params = new URLSearchParams();
		if (data.filters.search) params.set('q', data.filters.search);
		if (data.filters.creditType) params.set('creditType', data.filters.creditType);
		if (data.filters.source) params.set('source', data.filters.source);
		if (data.filters.from) params.set('from', data.filters.from);
		if (data.filters.to) params.set('to', data.filters.to);
		params.set('page', String(page));
		return `/staff/credits?${params.toString()}`;
	}
</script>

<PageHeader title="Credit Transactions" />
<PageContent>
	<DataTable data={data.transactions} clearHref="/staff/credits" empty="No credit transactions found">
		{#snippet toolbar()}
			<Filter.Search name="q" value={data.filters.search} placeholder="Search name or email..." />
			<Filter.Select name="creditType" value={data.filters.creditType} placeholder="All types"
				options={[['free_hours', 'Free Hours'], ['equipment_credits', 'Equipment Credits']]} />
			<Filter.Select name="source" value={data.filters.source} placeholder="All sources"
				options={[
					['monthly_allocation', 'Monthly Allocation'],
					['checkout', 'Checkout'],
					['refund', 'Refund'],
					['cancelled', 'Cancelled'],
					['admin_adjustment', 'Admin Adjustment']
				]} />
			<Filter.Date name="from" value={data.filters.from} />
			<Filter.Date name="to" value={data.filters.to} />
		{/snippet}
		<Column key="createdAt" header="Date" sortable type="datetime" />
		<MemberColumn nameKey="userName" emailKey="userEmail" userIdKey="userId" />
		<Column key="creditType" header="Type">
			{#snippet cell(_, t: Transaction)}
				<StatusBadge status={t.creditType === 'free_hours' ? 'Free Hours' : 'Equipment'} />
			{/snippet}
		</Column>
		<Column key="amount" header="Amount" shrink>
			{#snippet cell(_, t: Transaction)}
				<span class={t.amount > 0 ? 'text-success font-medium' : 'text-error font-medium'}>
					{t.amount > 0 ? '+' : ''}{t.amount}
				</span>
			{/snippet}
		</Column>
		<Column key="balanceAfter" header="Balance" shrink />
		<Column key="source" header="Source">
			{#snippet cell(_, t: Transaction)}
				{sourceLabels[t.source] ?? t.source}
			{/snippet}
		</Column>
		<Column key="description" header="Description" />
	</DataTable>

	<Pagination page={data.page} totalPages={data.totalPages} buildHref={buildPageHref} />
</PageContent>
