<script lang="ts">
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import Column from '$lib/components/shared/Table/Column.svelte';
	import MemberColumn from '$lib/components/shared/Table/MemberColumn.svelte';
	import * as Filter from '$lib/components/shared/Table/Filter';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import CreateBandModal from './CreateBandModal.svelte';
	import type { StaffBandsResponse } from '$lib/types/api';

	let { data }: { data: StaffBandsResponse } = $props();
	let showCreateModal = $state(false);
</script>

<div class="space-y-6">
	<PageHeader title="Bands">
		<button class="btn btn-sm btn-primary" onclick={() => (showCreateModal = true)}>
			New Band
		</button>
	</PageHeader>

	<CreateBandModal bind:open={showCreateModal} />

	<DataTable data={data.bands} rowHref={(b) => `/staff/bands/${b.id}`} clearHref="/staff/bands" empty="No bands found">
		{#snippet toolbar()}
			<Filter.Search name="q" value={data.filters.search} placeholder="Search by name..." />
			<Filter.Select name="status" value={data.filters.status} placeholder="All statuses"
				options={[['active', 'Active'], ['deactivated', 'Deactivated']]} />
		{/snippet}
		<Column key="deletedAt" header="" shrink>
			{#snippet cell(_, b)}
				<StatusBadge status={b.deletedAt ? 'deactivated' : 'active'} />
			{/snippet}
		</Column>
		<Column key="name" header="Name" sortable />
		<MemberColumn nameKey="ownerName" userIdKey="ownerId" header="Owner" />
		<Column key="memberCount" header="Members" sortable />
		<Column key="createdAt" header="Created" sortable type="date" />
	</DataTable>
</div>
