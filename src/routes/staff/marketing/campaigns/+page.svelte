<script lang="ts">
	import { getCampaigns } from '$lib/remote/marketing.remote';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import { formatDate } from '$lib/utils/format';

	let statusFilter = $state('');
	let campaigns = $derived(await getCampaigns({ status: statusFilter || undefined }));
</script>

	<PageHeader title="Campaigns" subtitle="Marketing">
		<Button href="/staff/marketing/campaigns/new" class="btn-sm">New Campaign</Button>
	</PageHeader>
<PageContent>
	<div class="flex gap-2 mb-4">
		<select class="select select-bordered select-sm" bind:value={statusFilter}>
			<option value="">All statuses</option>
			<option value="draft">Draft</option>
			<option value="scheduled">Scheduled</option>
			<option value="sent">Sent</option>
		</select>
	</div>

	{#if campaigns.length === 0}
		<p class="text-center opacity-60 py-8">No campaigns yet.</p>
	{:else}
		<div class="overflow-x-auto">
			<table class="table">
				<thead>
					<tr>
						<th>Subject</th>
						<th class="w-px">Status</th>
						<th>Audiences</th>
						<th class="w-px">Recipients</th>
						<th class="w-px">Date</th>
					</tr>
				</thead>
				<tbody>
					{#each campaigns as c (c.id)}
						<tr
							class="hover cursor-pointer"
							onclick={() => window.location.href = c.status === 'draft' ? `/staff/marketing/campaigns/${c.id}/edit` : `/staff/marketing/campaigns/${c.id}`}
						>
							<td><span class="font-medium">{c.subject}</span></td>
							<td class="w-px"><StatusBadge status={c.status} /></td>
							<td>
								{#if c.audienceNames.length > 0}
									{c.audienceNames.join(', ')}
								{:else}
									<span class="opacity-40">—</span>
								{/if}
							</td>
							<td class="w-px">{c.recipientCount ?? '—'}</td>
							<td class="w-px">
								{#if c.sentAt}
									{formatDate(c.sentAt)}
								{:else if c.scheduledFor}
									{formatDate(c.scheduledFor)}
								{:else}
									{formatDate(c.createdAt)}
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</PageContent>
