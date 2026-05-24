<script lang="ts">
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import Column from '$lib/components/shared/Table/Column.svelte';
	import MemberColumn from '$lib/components/shared/Table/MemberColumn.svelte';
	import * as Filter from '$lib/components/shared/Table/Filter';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import { CreateBandAction } from '$lib/components/shared/actions';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	function buildPageHref(page: number): string {
		const params = new URLSearchParams();
		if (data.filters.search) params.set('q', data.filters.search);
		if (data.filters.status) params.set('status', data.filters.status);
		params.set('page', String(page));
		return `/staff/bands?${params.toString()}`;
	}
</script>

<PageHeader title="Bands">
		<CreateBandAction />
	</PageHeader>
<PageContent>
	<DataTable data={data.bands} rowHref={(b) => `/staff/bands/${b.id}`} clearHref="/staff/bands" empty="No bands found"
		pagination={{ page: data.pagination.page, totalPages: data.pagination.totalPages }} {buildPageHref}>
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
</PageContent>
