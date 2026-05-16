<script lang="ts">
	import { getCampaigns } from './data.remote';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';

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

	{#if campaigns.length === 0}
		<EmptyState message="No campaigns yet." />
	{:else}
		<div class="overflow-x-auto">
			<table class="table">
				<thead>
					<tr>
						<th>Subject</th>
						<th>Status</th>
						<th>Audiences</th>
						<th>Recipients</th>
						<th>Date</th>
					</tr>
				</thead>
				<tbody>
					{#each campaigns as c (c.id)}
						<tr
							class="hover cursor-pointer"
							onclick={() => {
								if (c.status === 'draft') {
									window.location.href = `/staff/marketing/campaigns/${c.id}/edit`;
								} else {
									window.location.href = `/staff/marketing/campaigns/${c.id}`;
								}
							}}
						>
							<td class="font-medium">{c.subject}</td>
							<td><StatusBadge status={c.status} /></td>
							<td class="text-sm">
								{#if c.audienceNames.length > 0}
									{c.audienceNames.join(', ')}
								{:else}
									<span class="opacity-40">—</span>
								{/if}
							</td>
							<td class="text-sm">{c.recipientCount ?? '—'}</td>
							<td class="text-sm">
								{#if c.sentAt}
									{new Date(c.sentAt).toLocaleDateString()}
								{:else if c.scheduledFor}
									{new Date(c.scheduledFor).toLocaleString()}
								{:else}
									{new Date(c.createdAt).toLocaleDateString()}
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}


