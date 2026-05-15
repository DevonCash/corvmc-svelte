<script lang="ts">
	import type { PageServerData } from './$types';
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import Column from '$lib/components/shared/Table/Column.svelte';
	import MemberColumn from '$lib/components/shared/Table/MemberColumn.svelte';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import CreateBandModal from './CreateBandModal.svelte';

	let { data }: { data: PageServerData } = $props();
	let showCreateModal = $state(false);
</script>

<div class="space-y-6">
	<PageHeader title="Bands">
		<button class="btn btn-sm btn-primary" onclick={() => (showCreateModal = true)}>
			New Band
		</button>
	</PageHeader>

	<CreateBandModal bind:open={showCreateModal} />

	<!-- Filters -->
	<form method="get" class="flex flex-wrap items-end gap-2">
		<input
			type="text"
			name="q"
			value={data.filters.search}
			placeholder="Search by name..."
			class="input-bordered input input-sm w-48"
		/>
		<select name="status" class="select-bordered select select-sm">
			<option value="">All statuses</option>
			<option value="active" selected={data.filters.status === 'active'}>Active</option>
			<option value="deactivated" selected={data.filters.status === 'deactivated'}>Deactivated</option>
		</select>
		<button type="submit" class="btn btn-sm btn-primary">Filter</button>
		{#if data.filters.search || data.filters.status}
			<a href="/staff/bands" class="btn btn-ghost btn-sm">Clear</a>
		{/if}
	</form>

	<!-- Table -->
	<DataTable data={data.bands} rowHref={(b) => `/staff/bands/${b.id}`} empty="No bands found">
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
