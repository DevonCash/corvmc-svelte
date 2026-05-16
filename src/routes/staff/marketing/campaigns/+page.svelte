<script lang="ts">
	import { getCampaigns } from './data.remote';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import Column from '$lib/components/shared/Table/Column.svelte';

	let statusFilter = $state('');
	let campaigns = $derived(await getCampaigns({ status: statusFilter || undefined }));
</script>

	<PageHeader title="Campaigns" subtitle="Marketing">
		<a href="/staff/marketing/campaigns/new" class="btn btn-sm btn-primary">New Campaign</a>
	</PageHeader>

	<div class="flex gap-2 mb-4">
		<select class="select select-bordered select-sm" bind:value={statusFilter}>
			<option value="">All statuses</option>
			<option value="draft">Draft</option>
			<option value="scheduled">Scheduled</option>
			<option value="sent">Sent</option>
		</select>
	</div>

	<DataTable
		data={campaigns}
		rowHref={(c) => c.status === 'draft' ? `/staff/marketing/campaigns/${c.id}/edit` : `/staff/marketing/campaigns/${c.id}`}
		empty="No campaigns yet."
	>
		<Column key="subject" header="Subject" sortable>
			{#snippet cell(_, c)}
				<span class="font-medium">{c.subject}</span>
			{/snippet}
		</Column>
		<Column key="status" header="Status" shrink>
			{#snippet cell(_, c)}
				<StatusBadge status={c.status} />
			{/snippet}
		</Column>
		<Column key="audienceNames" header="Audiences">
			{#snippet cell(_, c)}
				{#if c.audienceNames.length > 0}
					{c.audienceNames.join(', ')}
				{:else}
					<span class="opacity-40">—</span>
				{/if}
			{/snippet}
		</Column>
		<Column key="recipientCount" header="Recipients" shrink>
			{#snippet cell(_, c)}
				{c.recipientCount ?? '—'}
			{/snippet}
		</Column>
		<Column key="date" header="Date" shrink>
			{#snippet cell(_, c)}
				{#if c.sentAt}
					{new Date(c.sentAt).toLocaleDateString()}
				{:else if c.scheduledFor}
					{new Date(c.scheduledFor).toLocaleString()}
				{:else}
					{new Date(c.createdAt).toLocaleDateString()}
				{/if}
			{/snippet}
		</Column>
	</DataTable>


