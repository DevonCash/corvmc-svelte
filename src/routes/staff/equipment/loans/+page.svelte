<script lang="ts">
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import Column from '$lib/components/shared/Table/Column.svelte';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import { formatDate, formatCents } from '$lib/utils/format';
	import { loanStatuses } from '$lib/server/equipment/types';
	import type { StaffEquipmentLoansResponse } from '$lib/types/api';

	let { data }: { data: StaffEquipmentLoansResponse } = $props();
</script>

<div class="space-y-6">
	<PageHeader title="Equipment Loans" backHref="/staff/equipment" />

	<!-- Filters -->
	<form method="get" class="flex flex-wrap items-end gap-2">
		<input
			type="text"
			name="q"
			value={data.filters.search}
			placeholder="Search by member..."
			class="input-bordered input input-sm w-48"
		/>
		<select name="status" class="select-bordered select select-sm">
			<option value="">All statuses</option>
			{#each loanStatuses as s}
				<option value={s} selected={data.filters.status === s}>{s.replace('_', ' ')}</option>
			{/each}
		</select>
		<button type="submit" class="btn btn-sm btn-primary">Filter</button>
		{#if data.filters.search || data.filters.status}
			<a href="/staff/equipment/loans" class="btn btn-ghost btn-sm">Clear</a>
		{/if}
	</form>

	<DataTable data={data.loans} rowHref={(l) => `/staff/equipment/loans/${l.id}`} empty="No loans found">
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
