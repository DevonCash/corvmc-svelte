<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import InfoCard from '$lib/components/shared/InfoCard.svelte';
	import { UnscheduleCampaignAction } from '$lib/components/shared/actions';
	import Button from '$lib/components/shared/Button.svelte';
	import { getCampaignDetail } from '$lib/remote/marketing.remote';
	import { sanitizeHtml } from '$lib/utils/markdown';

	let id = $derived(page.params.id!);
	let campaign = $derived(await getCampaignDetail(id));
</script>

{#if campaign}
	<PageHeader subtitle="Campaign" title={campaign.subject} backHref="/staff/marketing/campaigns">
		<StatusBadge status={campaign.status} />
		{#if campaign.status === 'draft'}
			<Button href="/staff/marketing/campaigns/{id}/edit" class="btn-sm">Edit</Button>
		{/if}
		{#if campaign.status === 'scheduled'}
			<UnscheduleCampaignAction
				campaignId={id}
				onsuccess={() => goto(resolve(`/staff/marketing/campaigns/${id}/edit`))}
			/>
		{/if}
	</PageHeader>
	<PageContent width="3xl">
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
				<pre
					class="text-xs font-mono bg-base-200 p-3 rounded overflow-auto max-h-64 whitespace-pre-wrap">{campaign.markdownBody}</pre>
			</InfoCard>
		</div>

		<InfoCard title="Rendered Preview">
			<div class="border rounded-lg bg-white overflow-hidden">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted/sanitized HTML (admin campaign HTML) -->
				{@html sanitizeHtml(campaign.htmlBody)}
			</div>
		</InfoCard>
	</PageContent>
{/if}
