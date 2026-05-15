<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import InfoCard from '$lib/components/shared/InfoCard.svelte';
	import AsyncButton from '$lib/components/shared/AsyncButton.svelte';
	import { getCampaignDetail, unscheduleCommand } from './data.remote';

	let id = $derived(page.params.id!);
	let campaign = $derived(await getCampaignDetail(id));
</script>

<svelte:boundary>
	{#if campaign}
		<PageHeader subtitle="Campaign" title={campaign.subject} backHref="/staff/marketing/campaigns">
			<StatusBadge status={campaign.status} />
			{#if campaign.status === 'draft'}
				<a href="/staff/marketing/campaigns/{id}/edit" class="btn btn-sm btn-primary">Edit</a>
			{/if}
			{#if campaign.status === 'scheduled'}
				<AsyncButton
					action={async () => {
						await unscheduleCommand({});
						toast.success('Campaign unscheduled — returned to draft');
						goto(`/staff/marketing/campaigns/${id}/edit`);
					}}
					label="Cancel Schedule"
					class="btn-warning btn-sm"
				/>
			{/if}
		</PageHeader>

		<div class="grid gap-6 lg:grid-cols-2 mb-6">
			<InfoCard title="Details">
				<dl class="grid gap-x-4 gap-y-2 text-sm" style="grid-template-columns: auto 1fr;">
					<dt class="opacity-60">Status</dt>
					<dd><StatusBadge status={campaign.status} /></dd>

					<dt class="opacity-60">Audiences</dt>
					<dd>{campaign.audiences.map((a) => a.name).join(', ') || '—'}</dd>

					{#if campaign.recipientCount !== null}
						<dt class="opacity-60">Recipients</dt>
						<dd>{campaign.recipientCount}</dd>
					{/if}

					{#if campaign.sentAt}
						<dt class="opacity-60">Sent at</dt>
						<dd>{new Date(campaign.sentAt).toLocaleString()}</dd>
					{/if}

					{#if campaign.scheduledFor && !campaign.sentAt}
						<dt class="opacity-60">Scheduled for</dt>
						<dd>{new Date(campaign.scheduledFor).toLocaleString()}</dd>
					{/if}

					<dt class="opacity-60">Created</dt>
					<dd>{new Date(campaign.createdAt).toLocaleDateString()}</dd>
				</dl>
			</InfoCard>

			<InfoCard title="Markdown Source">
				<pre class="text-xs font-mono bg-base-200 p-3 rounded overflow-auto max-h-64 whitespace-pre-wrap">{campaign.markdownBody}</pre>
			</InfoCard>
		</div>

		<InfoCard title="Rendered Preview">
			<div class="border rounded-lg bg-white overflow-hidden">
				{@html campaign.htmlBody}
			</div>
		</InfoCard>
	{/if}

	{#snippet pending()}
		<div class="flex items-center justify-center p-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{/snippet}

	{#snippet failed(error, reset)}
		<div class="alert alert-error">
			<p>Failed to load campaign: {String(error)}</p>
			<button class="btn btn-sm" onclick={reset}>Retry</button>
		</div>
	{/snippet}
</svelte:boundary>
