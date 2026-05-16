<script lang="ts">
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import Column from '$lib/components/shared/Table/Column.svelte';
	import * as Filter from '$lib/components/shared/Table/Filter';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import { formatDate, formatCents } from '$lib/utils/format';
	import { loanStatuses } from '$lib/types/equipment';
	import type { StaffEquipmentLoansResponse } from '$lib/types/api';

	let { data }: { data: StaffEquipmentLoansResponse } = $props();
</script>

<div class="space-y-6">
	<PageHeader title="Equipment Loans" backHref="/staff/equipment" />

	<DataTable data={data.loans} rowHref={(l) => `/staff/equipment/loans/${l.id}`} clearHref="/staff/equipment/loans" empty="No loans found">
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
					<span class="badge badge-error badge-xs ml-1">Overdue</span>
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
</div>
