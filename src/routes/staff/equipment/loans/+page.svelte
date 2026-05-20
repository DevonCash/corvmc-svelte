<script lang="ts">
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import Column from '$lib/components/shared/Table/Column.svelte';
	import * as Filter from '$lib/components/shared/Table/Filter';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Badge from '$lib/components/shared/Badge.svelte';
	import { formatDate, formatCents } from '$lib/utils/format';
	import { loanStatuses } from '$lib/config';
	import { CreateLoanAction } from '$lib/components/shared/actions';
	import type { StaffEquipmentLoansResponse } from '$lib/server/db/schema/api';

	let { data }: { data: StaffEquipmentLoansResponse } = $props();

	function buildPageHref(page: number): string {
		const params = new URLSearchParams();
		if (data.filters.search) params.set('q', data.filters.search);
		if (data.filters.status) params.set('status', data.filters.status);
		params.set('page', String(page));
		return `/staff/equipment/loans?${params.toString()}`;
	}
</script>

<PageHeader title="Equipment Loans" backHref="/staff/equipment">
	<CreateLoanAction />
</PageHeader>
<PageContent>

	<DataTable data={data.loans} rowHref={(l) => `/staff/equipment/loans/${l.id}`} clearHref="/staff/equipment/loans" empty="No loans found"
		pagination={{ page: data.pagination.page, totalPages: data.pagination.totalPages }} {buildPageHref}>
		{#snippet toolbar()}
			<Filter.Search name="q" value={data.filters.search} placeholder="Search by member..." />
			<Filter.Select name="status" value={data.filters.status} placeholder="All statuses"
				options={loanStatuses} />
		{/snippet}
		<Column key="userName" header="Member" sortable />
		<Column key="equipmentName" header="Equipment">
			{#snippet cell(_, l)}
				{l.equipmentName ?? '(free-form request)'}
			{/snippet}
		</Column>
		<Column key="status" header="Status" shrink>
			{#snippet cell(_, l)}
				<StatusBadge status={l.status} />
				{#if l.isOverdue}
					<Badge variant="error" size="xs" class="ml-1">Overdue</Badge>
				{/if}
			{/snippet}
		</Column>
		<Column key="requestedPickupDate" header="Requested" sortable type="date" />
		<Column key="dueDate" header="Due" shrink>
			{#snippet cell(_, l)}
				{l.dueDate ? formatDate(l.dueDate) : '—'}
			{/snippet}
		</Column>
		<Column key="totalChargeCents" header="Charge" shrink>
			{#snippet cell(_, l)}
				{l.totalChargeCents != null ? formatCents(l.totalChargeCents) : '—'}
			{/snippet}
		</Column>
	</DataTable>
</PageContent>
